/**
 * Email HTML templates for Brevo transactional emails
 */

const otpEmailTemplate = (otpCode) => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
    <div style="background: #C19A6B; padding: 30px 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">Feauage</h1>
      <p style="color: white; margin: 10px 0 0;">Premium Jewelry Store</p>
      <p style="color: white; margin: 10px 0 0;">Email Verification</p>
    </div>
    <div style="padding: 40px 30px; text-align: center;">
      <p style="font-size: 16px;">Your One-Time Password (OTP) for registration is:</p>
      <h1 style="background: #f4f4f4; padding: 15px 20px; font-family: monospace; font-size: 32px; letter-spacing: 5px; border-radius: 5px; display: inline-block;">${otpCode}</h1>
      <p style="color: #888; margin-top: 20px;">This OTP is valid for 10 minutes.</p>
      <p style="color: #888;">If you didn't request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

const contactFormEmailTemplate = (formData) => `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
      <div style="background: #C19A6B; padding: 30px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Feauage</h1>
        <p style="color: white; margin: 10px 0 0;">Premium Jewelry Store</p>
        <p style="color: white; margin: 10px 0 0;">New Contact Form Submission</p>
      </div>
      <div style="padding: 40px 30px;">
        <div style="margin-bottom: 30px;">
          <h3 style="color: #C19A6B; border-bottom: 2px solid #C19A6B; padding-bottom: 10px;">Sender Information</h3>
          <p><strong>Name:</strong> ${formData.name}</p>
          <p><strong>Email:</strong> ${formData.email}</p>
        </div>
        <div>
          <h3 style="color: #C19A6B; border-bottom: 2px solid #C19A6B; padding-bottom: 10px;">Message</h3>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 5px;">
            ${formData.message.replace(/\n/g, '<br>')}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;

module.exports = { otpEmailTemplate, contactFormEmailTemplate };
