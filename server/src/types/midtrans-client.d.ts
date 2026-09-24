// Type declaration for midtrans-client (no official @types package)
declare module 'midtrans-client' {
  interface SnapConfig {
    isProduction: boolean
    serverKey: string
    clientKey: string
  }

  interface TransactionDetails {
    order_id: string
    gross_amount: number
  }

  interface ItemDetail {
    id: string
    price: number
    quantity: number
    name: string
  }

  interface CustomerDetails {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
  }

  interface CreateTransactionParams {
    transaction_details: TransactionDetails
    item_details?: ItemDetail[]
    customer_details?: CustomerDetails
    [key: string]: unknown
  }

  interface TransactionResponse {
    token: string
    redirect_url: string
  }

  interface NotificationStatus {
    order_id: string
    transaction_status: string
    fraud_status: string
    payment_type: string
    transaction_id: string
    [key: string]: unknown
  }

  interface TransactionClient {
    notification(body: unknown): Promise<NotificationStatus>
  }

  class Snap {
    constructor(config: SnapConfig)
    createTransaction(params: CreateTransactionParams): Promise<TransactionResponse>
    transaction: TransactionClient
  }

  export = { Snap }
}
