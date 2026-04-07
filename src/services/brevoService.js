const SibApiV3Sdk = require('sib-api-v3-sdk');

// Initialize the Brevo (Sendinblue) client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Generic email sending function using REST API
 * @param {Object} emailData - Email configuration object
 * @returns {Promise} Response from Brevo API
 */
const sendEmail = async (emailData) => {
  try {
    console.log('Sending email with data:', {
      sender: emailData.sender.email,
      to: emailData.to[0]?.email,
      subject: emailData.subject,
    });

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY.trim(),
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Email sent successfully:', data);
      return { success: true, data };
    } else {
      console.error('Brevo API error:', data);
      throw {
        success: false,
        code: data.code,
        message: data.message || 'Failed to send email'
      };
    }
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

/**
 * Send OTP email
 * @param {string} toEmail - Recipient email
 * @param {string} otpCode - OTP code
 */
const sendOtpEmail = async (toEmail, otpCode) => {
  try {
    const emailData = {
      to: [{ email: toEmail }],
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME,
      },
      subject: 'Your OTP for Registration',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <body>
          <h2>Email Verification</h2>
          <p>Your One-Time Password (OTP) for registration is:</p>
          <h1 style="background:#f4f4f4; padding:10px; font-family:monospace;">${otpCode}</h1>
          <p>This OTP is valid for 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </body>
        </html>
      `,
    };

    return await sendEmail(emailData);
  } catch (error) {
    console.error('Brevo SendOTP Error:', error);
    throw error;
  }
};

/**
 * Send contact form email
 * @param {Object} formData - Form data { name, email, message }
 * @param {string} recipientEmail - Where to send the contact form
 */
const sendContactFormEmail = async (formData, recipientEmail = process.env.BREVO_CONTACT_EMAIL) => {
  try {
    const emailData = {
      sender: {
        name: process.env.BREVO_SENDER_NAME,
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{
        email: recipientEmail,
        name: 'Admin'
      }],
      replyTo: {
        email: formData.email,
        name: formData.name
      },
      subject: `New Contact Form Message from ${formData.name}`,
      htmlContent: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <div style="background: #C19A6B; padding: 30px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">AXELS JEWELRY</h1>
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
      `
    };

    return await sendEmail(emailData);
  } catch (error) {
    console.error('Brevo Contact Form Error:', error);
    throw error;
  }
};

/**
 * Create email campaign
 * @param {Object} campaignData - Campaign configuration
 */
const createEmailCampaign = async (campaignData) => {
  try {
    const emailCampaigns = new SibApiV3Sdk.CreateEmailCampaign();
    
    // Define the campaign settings
    emailCampaigns.name = campaignData.name || 'Campaign sent via the API';
    emailCampaigns.subject = campaignData.subject || 'Default Subject';
    emailCampaigns.sender = {
      name: campaignData.senderName || process.env.BREVO_SENDER_NAME,
      email: campaignData.senderEmail || process.env.BREVO_SENDER_EMAIL,
    };
    emailCampaigns.type = campaignData.type || 'classic';
    
    // Content that will be sent
    emailCampaigns.htmlContent = campaignData.htmlContent;
    
    // Select the recipients
    emailCampaigns.recipients = {
      listIds: campaignData.listIds || [],
    };
    
    // Schedule the sending (optional)
    if (campaignData.scheduledAt) {
      emailCampaigns.scheduledAt = campaignData.scheduledAt;
    }
    
    // Create the email campaigns API instance
    const emailCampaignsApi = new SibApiV3Sdk.EmailCampaignsApi();
    
    // Make the call to the client
    const response = await emailCampaignsApi.createEmailCampaign(emailCampaigns);
    console.log('Campaign created successfully. Returned data:', response);
    return response;
  } catch (error) {
    console.error('Brevo Create Campaign Error:', error);
    throw error;
  }
};

module.exports = { sendEmail, sendOtpEmail, sendContactFormEmail, createEmailCampaign };