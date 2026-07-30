import nodemailer from "nodemailer";
import { logger } from "../utils/logger";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpHost || !smtpUser || !smtpPassword) {
      logger.warn("Email service not configured. Magic links won't be sent.");
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });
  }

  async sendMagicLink(
    email: string,
    token: string,
    appUrl: string = "http://localhost:3000"
  ): Promise<boolean> {
    if (!this.transporter) {
      logger.warn("Email service not configured. Magic link not sent.");
      return false;
    }

    const magicLinkUrl = `${appUrl}/auth/magic-link/${token}`;

    const emailOptions: EmailOptions = {
      to: email,
      subject: "Your Magic Link - English Learning Platform",
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2c3e50;">Welcome to English Mastery!</h2>
              
              <p>We received a request to sign in to your account using this email address.</p>
              
              <p>Click the button below to sign in (this link expires in 15 minutes):</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${magicLinkUrl}" 
                   style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Sign In with Magic Link
                </a>
              </div>
              
              <p style="font-size: 12px; color: #7f8c8d;">
                Or copy and paste this link in your browser:<br/>
                <code style="word-break: break-all;">${magicLinkUrl}</code>
              </p>
              
              <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #7f8c8d;">
                If you didn't request this link, you can safely ignore this email.<br/>
                This link is valid for 15 minutes and can only be used once.
              </p>
              
              <p style="font-size: 12px; color: #7f8c8d; margin-top: 20px;">
                Best regards,<br/>
                English Mastery Team
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
        Sign in to English Mastery Platform
        
        Click the link below to sign in (valid for 15 minutes):
        ${magicLinkUrl}
        
        If you didn't request this, you can safely ignore this email.
      `,
    };

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || "noreply@englishlearning.com",
        ...emailOptions,
      });

      logger.info(`Magic link email sent to ${email}`, { messageId: info.messageId });
      return true;
    } catch (error) {
      logger.error(`Failed to send magic link email to ${email}`, error);
      return false;
    }
  }

  async sendWelcomeEmail(
    email: string,
    firstName: string = "User"
  ): Promise<boolean> {
    if (!this.transporter) {
      logger.warn("Email service not configured. Welcome email not sent.");
      return false;
    }

    const emailOptions: EmailOptions = {
      to: email,
      subject: "Welcome to English Mastery - Start Your Learning Journey",
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2c3e50;">Welcome, ${firstName}!</h2>
              
              <p>Your account has been created successfully. You're now ready to start your English learning journey.</p>
              
              <h3 style="color: #34495e;">Get Started:</h3>
              <ol>
                <li>Complete your learning profile</li>
                <li>Choose your starting level (A1-C2)</li>
                <li>Select vocabulary categories to study</li>
                <li>Begin learning with our interactive lessons</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:3000/dashboard" 
                   style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <h3 style="color: #34495e;">Features:</h3>
              <ul>
                <li>AI-powered vocabulary generation</li>
                <li>Interactive lessons with 6 learning sections</li>
                <li>Spaced repetition flashcards</li>
                <li>Progress tracking and analytics</li>
                <li>Tamil translations for all content</li>
              </ul>
              
              <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #7f8c8d;">
                If you have any questions, feel free to reach out to us.<br/>
                Happy learning!
              </p>
              
              <p style="font-size: 12px; color: #7f8c8d; margin-top: 20px;">
                Best regards,<br/>
                English Mastery Team
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
        Welcome to English Mastery, ${firstName}!
        
        Your account has been created. Start your learning journey at:
        http://localhost:3000/dashboard
        
        Happy learning!
      `,
    };

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL || "noreply@englishlearning.com",
        ...emailOptions,
      });

      logger.info(`Welcome email sent to ${email}`, { messageId: info.messageId });
      return true;
    } catch (error) {
      logger.error(`Failed to send welcome email to ${email}`, error);
      return false;
    }
  }
}
