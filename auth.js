// auth.js - Authentication Logic (OAuth + OTP)

const axios = require('axios');
const nodemailer = require('nodemailer');

/*
 *CONFIGURATION
*/
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI;
const SENDER_EMAIL         = process.env.SENDER_EMAIL;
const SENDER_APP_PASSWORD  = process.env.SENDER_APP_PASSWORD;

const ALLOWED_EMAILS = [
  'shivashaktipattusarees@gmail.com',
  'second-admin@gmail.com'
];

const OTP_EXPIRY_SECONDS = 300;
const MAX_OTP_ATTEMPTS   = 5;

/*
 *OTP STORE (In-memory storage)
*/
const otpStore = {}; // { email: { otp, expiresAt, attempts } }


/**
 * Generate OAuth URL for Google login
 */
const getGoogleAuthURL = () => {
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'offline',
    prompt:        'consent'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

/**
 * Exchange OAuth code for tokens and user info
 */
const getGoogleUserInfo = async (code) => {
  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  GOOGLE_REDIRECT_URI,
      grant_type:    'authorization_code'
    });

    const tokens = tokenRes.data;
    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Get user info
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    return userRes.data; // { email, name, picture }

  } catch (error) {
    throw new Error(`OAuth error: ${error.message}`);
  }
};

/**
 * Generate HTML for OAuth callback popup
 */
const popupHtml = ({ email = '', name = '', picture = '', error = '' }) => {
  const payload = JSON.stringify({ email, name, picture, error });
  return `<!DOCTYPE html>
<html>
<head><title>Authenticating…</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px;color:#555;background:#fdf6ec;">
  <p>${error ? '❌ ' + error : '✅ Signed in! Closing window…'}</p>
  <script>
    const target = 'http://localhost:5000';
    try { window.opener && window.opener.postMessage(${payload}, target); } catch(e) {}
    setTimeout(() => window.close(), 800);
  <\/script>
</body>
</html>`;
};

// OTP FUNCTIONS

/**
 * Check if email is authorized
 */
const isAuthorizedEmail = (email) => {
  return ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
};

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

/**
 * Send OTP via email
 */
const sendOTP = async (email) => {
  if (!isAuthorizedEmail(email)) {
    throw new Error('Unauthorised email');
  }

  const otp = generateOTP();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
    attempts: 0
  };

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SENDER_EMAIL, pass: SENDER_APP_PASSWORD }
    });

    await transporter.sendMail({
      from:    SENDER_EMAIL,
      to:      email,
      subject: '🔐 Shivashakti Admin OTP',
      html: getOTPEmailHTML(otp)
    });

    console.log(`[AUTH] OTP sent to ${email}`);
    return { success: true, message: 'OTP sent successfully' };

  } catch (error) {
    console.error('[AUTH ERROR]', error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Verify OTP
 */
const verifyOTP = (email, otp) => {
  email = email.trim().toLowerCase();
  otp = otp.trim();

  const record = otpStore[email];

  if (!record) {
    throw { status: 400, message: 'No OTP found. Please request a new one.' };
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    delete otpStore[email];
    throw { status: 429, message: 'Too many failed attempts. Please sign in again.' };
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    throw { status: 400, message: 'OTP expired. Please request a new one.' };
  }

  if (otp !== record.otp) {
    otpStore[email].attempts += 1;
    const remaining = MAX_OTP_ATTEMPTS - otpStore[email].attempts;
    throw { status: 400, message: `Incorrect OTP. ${remaining} attempt(s) left.` };
  }

  delete otpStore[email];
  console.log(`[AUTH] OTP verified for ${email}`);
  return { success: true };
};

/**
 * Get OTP Email HTML
 */
const getOTPEmailHTML = (otp) => {
  return `
    <div style="font-family:Georgia,serif;max-width:480px;margin:auto;
                background:#fdf6ec;border:1px solid #c9a84c;
                border-radius:12px;padding:40px;text-align:center;">
      <h2 style="color:#8b0000;letter-spacing:2px;margin-bottom:4px;">
        Shivashakti Pattu Sarees
      </h2>
      <p style="color:#8b6040;font-size:0.85rem;margin-bottom:30px;">
        Admin Panel · One-Time Password
      </p>
      <p style="color:#3d1f00;font-size:1rem;margin-bottom:16px;">Your secure OTP is:</p>
      <div style="background:#8b0000;color:#e2c06a;
                  font-size:2.8rem;font-weight:700;letter-spacing:14px;
                  padding:20px 30px;border-radius:10px;
                  display:inline-block;margin-bottom:24px;">
        ${otp}
      </div>
      <p style="color:#8b6040;font-size:0.88rem;line-height:1.7;margin-bottom:10px;">
        Valid for <strong>5 minutes</strong> only.<br>Do not share this with anyone.
      </p>
      <p style="color:#c0392b;font-size:0.82rem;">
        If you didn't request this, ignore this email.
      </p>
    </div>
  `;
};

// EXPORTS
module.exports = {
  // OAuth functions
  getGoogleAuthURL,
  getGoogleUserInfo,
  popupHtml,
  
  // OTP functions
  isAuthorizedEmail,
  generateOTP,
  sendOTP,
  verifyOTP,
  
  // Configuration
  ALLOWED_EMAILS,
  OTP_EXPIRY_SECONDS
};