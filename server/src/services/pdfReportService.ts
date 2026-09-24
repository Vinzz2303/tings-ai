import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export async function generatePortfolioPDF(userId: number, userName: string, data: any[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const buffers: Buffer[] = []
      
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))

      // Title
      doc.fontSize(20).text('Premium Portfolio Report', { align: 'center' })
      doc.moveDown()
      
      // Subtitle
      doc.fontSize(12).text(`Generated for: ${userName}`, { align: 'center' })
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
      doc.moveDown(2)

      // Content
      if (data && data.length > 0) {
        doc.fontSize(14).text('Asset Holdings', { underline: true })
        doc.moveDown()

        data.forEach((asset, index) => {
          doc.fontSize(12).text(`${index + 1}. ${asset.symbol}`)
          doc.fontSize(10).text(`   Quantity: ${asset.quantity} | Avg Price: ${asset.entryPrice} ${asset.entryCurrency}`)
          doc.moveDown(0.5)
        })
      } else {
        doc.fontSize(12).text('No assets found in portfolio.', { align: 'center' })
      }

      // Footer
      doc.moveDown(3)
      doc.fontSize(10).fillColor('gray').text('Ting AI Pro - Wealth Intelligence', { align: 'center' })
      
      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
