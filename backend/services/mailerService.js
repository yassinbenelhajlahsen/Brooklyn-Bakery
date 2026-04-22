import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,        
    pass: process.env.GMAIL_APP_PASSWORD 
  }
});

async function sendConfirmationEmail({ to, customerName, orderDetails }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Email credentials not configured. Skipping email send.');
    console.warn('Set GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
    return { skipped: true, reason: 'Missing email credentials' };
  }

  const items = orderDetails.items.map(item => ({
    ...item,
    price: (item.price)
  }));
  const total = (orderDetails.total);

  const mailOptions = {
    from: `Brooklyn Bakery<${process.env.GMAIL_USER}>`,
    to: to,
    subject: `Order Confirmation – ${orderDetails.orderId}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
        <h2>Thanks for your order, ${customerName}!</h2>
        <p>Here's a summary of your order:</p>
 
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f4f4f4;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Qty</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.qty}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.price} pts</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
 
        <p style="margin-top: 16px;"><strong>Total: ${total} pts</strong></p>
        <p>We'll notify you when your order ships. Reply to this email if you have any questions.</p>
        <p style="color: #888; font-size: 12px;">Order ID: ${orderDetails.orderId}</p>
      </div>
    `
  };
 
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent to:', to);
    return info;
  } catch (err) {
    console.error('Failed to send confirmation email:', err.message);
    throw err;
  }
}

export { sendConfirmationEmail };
 