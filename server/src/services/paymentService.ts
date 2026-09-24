import midtransClient from 'midtrans-client'
import crypto from 'crypto'
import pool from '../db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
const clientKey = process.env.MIDTRANS_CLIENT_KEY || ''

// Initialize Snap Client
export const snap = new midtransClient.Snap({
  isProduction,
  serverKey,
  clientKey
})

export async function createProSubscriptionTx(userId: number, email: string, name: string): Promise<string> {
  const orderId = `PRO-${userId}-${Date.now()}`
  const grossAmount = 30000 // Rp 30,000 / month

  // Create snap transaction
  const parameters = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount
    },
    customer_details: {
      first_name: name || 'Investor',
      email: email
    },
    item_details: [
      {
        id: 'TING-PRO-1M',
        price: grossAmount,
        quantity: 1,
        name: 'Ting AI Pro - 1 Bulan'
      }
    ]
  }

  // Insert into DB pending
  await pool.query(
    'INSERT INTO subscriptions (id, user_id, plan_type, gross_amount, status) VALUES (?, ?, ?, ?, ?)',
    [orderId, userId, 'PRO_1M', grossAmount, 'pending']
  )

  const transaction = await snap.createTransaction(parameters)
  return transaction.token
}

export async function handleMidtransWebhook(notification: any): Promise<void> {
  const statusResponse = await snap.transaction.notification(notification)
  const orderId = statusResponse.order_id
  const transactionStatus = statusResponse.transaction_status
  const fraudStatus = statusResponse.fraud_status
  const paymentType = statusResponse.payment_type
  const transactionId = statusResponse.transaction_id

  console.log(`[Midtrans] Webhook received for order ${orderId}, status: ${transactionStatus}`)

  let statusToSave = 'pending'

  if (transactionStatus === 'capture') {
    if (fraudStatus === 'challenge') {
      statusToSave = 'challenge'
    } else if (fraudStatus === 'accept') {
      statusToSave = 'settled'
    }
  } else if (transactionStatus === 'settlement') {
    statusToSave = 'settled'
  } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
    statusToSave = 'failed'
  } else if (transactionStatus === 'pending') {
    statusToSave = 'pending'
  }

  // Update subscription status in DB
  await pool.query(
    `UPDATE subscriptions 
     SET status = ?, payment_type = ?, transaction_id = ?, settled_at = IF(? = 'settled', CURRENT_TIMESTAMP, settled_at)
     WHERE id = ?`,
    [statusToSave, paymentType, transactionId, statusToSave, orderId]
  )

  // If settled, update user's is_pro status
  if (statusToSave === 'settled') {
    const [subs] = await pool.query<RowDataPacket[]>('SELECT user_id FROM subscriptions WHERE id = ?', [orderId])
    if (subs.length > 0) {
      const userId = subs[0].user_id
      await pool.query('UPDATE users SET is_pro = 1 WHERE id = ?', [userId])
      console.log(`[Midtrans] User ${userId} upgraded to Pro.`)
    }
  }
}
