import nodemailer from 'nodemailer';

export interface EmailServiceConfig {
  smtpUser: string;
  smtpPassword: string;
}

/**
 * EmailService - Send transactional emails via NameCheap Private Email SMTP
 * MVP 16: Full authentication support
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private fromAddress: string = '"Hidden Walnuts" <noreply@hiddenwalnuts.com>';

  constructor(config: EmailServiceConfig) {
    this.transporter = nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      }
    });
  }

  /**
   * Send email verification link
   * @param email - Recipient email
   * @param username - User's username
   * @param token - Verification token (UUID)
   */
  async sendVerificationEmail(
    email: string,
    username: string,
    token: string,
    baseUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const verificationUrl = `${baseUrl}/verify?token=${token}`;

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Verify your Hidden Walnuts account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2E7D32; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
              .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Hidden Walnuts!</h1>
              </div>
              <div class="content">
                <h2>Hi ${username},</h2>
                <p>Thanks for signing up! Click the button below to verify your email address and unlock 6 characters:</p>

                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>

                <p><strong>What you'll unlock:</strong></p>
                <ul>
                  <li>6 playable characters (Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard)</li>
                  <li>Cross-device sync - play on any device</li>
                  <li>Hall of Fame leaderboard access</li>
                  <li>Progress tracking & stats</li>
                </ul>

                <p>This verification link expires in 24 hours.</p>

                <p style="color: #666; font-size: 14px;">
                  If you didn't create this account, you can safely ignore this email.
                </p>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  Or copy and paste this link into your browser:<br>
                  <a href="${verificationUrl}">${verificationUrl}</a>
                </p>
              </div>
              <div class="footer">
                <p>Happy walnut hunting!</p>
                <p>The Hidden Walnuts Team</p>
                <p style="margin-top: 20px; font-size: 11px; color: #999;">
                  You received this email because you signed up for Hidden Walnuts.
                  <br>
                  <a href="https://hiddenwalnuts.com" style="color: #999;">hiddenwalnuts.com</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log(`✅ Verification email sent to ${email}`);
      return { success: true };

    } catch (error) {
      console.error('Failed to send verification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send password reset link
   * @param email - Recipient email
   * @param username - User's username
   * @param token - Reset token (UUID)
   */
  async sendPasswordResetEmail(
    email: string,
    username: string,
    token: string,
    baseUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Reset your Hidden Walnuts password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #FF6B6B; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
              .button { display: inline-block; padding: 12px 30px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
              .warning { background-color: #FFF3CD; border-left: 4px solid #FFA000; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Password Reset Request</h1>
              </div>
              <div class="content">
                <h2>Hi ${username},</h2>
                <p>We received a request to reset your Hidden Walnuts password. Click the button below to create a new password:</p>

                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>

                <div class="warning">
                  <strong>⚠️ Security Notice:</strong> This link expires in 1 hour for security reasons.
                </div>

                <p style="color: #666; font-size: 14px;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>

                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  Or copy and paste this link into your browser:<br>
                  <a href="${resetUrl}">${resetUrl}</a>
                </p>
              </div>
              <div class="footer">
                <p>Stay secure!</p>
                <p>The Hidden Walnuts Team</p>
                <p style="margin-top: 20px; font-size: 11px; color: #999;">
                  You received this email because you requested a password reset for your Hidden Walnuts account.
                  <br>
                  <a href="https://hiddenwalnuts.com" style="color: #999;">hiddenwalnuts.com</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log(`✅ Password reset email sent to ${email}`);
      return { success: true };

    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send welcome email (after verification)
   * @param email - Recipient email
   * @param username - User's username
   */
  async sendWelcomeEmail(
    email: string,
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Welcome to Hidden Walnuts!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
              .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .features { background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome, ${username}!</h1>
              </div>
              <div class="content">
                <h2>Your account is verified!</h2>
                <p>You now have access to all these features:</p>

                <div class="features">
                  <h3>✅ Your Unlocked Benefits:</h3>
                  <ul>
                    <li><strong>6 Characters</strong> - Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard</li>
                    <li><strong>Cross-Device Sync</strong> - Play on desktop, tablet, or phone seamlessly</li>
                    <li><strong>Hall of Fame</strong> - Compete for all-time glory on the leaderboard</li>
                    <li><strong>Progress Tracking</strong> - Your stats are saved forever</li>
                    <li><strong>Verified Badge</strong> - Show off your 🔒 badge on leaderboards</li>
                  </ul>
                </div>

                <div style="text-align: center;">
                  <a href="https://hiddenwalnuts.com" class="button">Start Playing Now!</a>
                </div>

                <p style="margin-top: 30px;">
                  <strong>What's next?</strong> Premium characters (Lynx, Bear, Moose, Badger) coming soon in future updates!
                </p>
              </div>
              <div class="footer">
                <p>Happy walnut hunting!</p>
                <p>The Hidden Walnuts Team</p>
                <p style="margin-top: 20px; font-size: 11px; color: #999;">
                  You received this email because you signed up for Hidden Walnuts.
                  <br>
                  <a href="https://hiddenwalnuts.com" style="color: #999;">hiddenwalnuts.com</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log(`✅ Welcome email sent to ${email}`);
      return { success: true };

    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
