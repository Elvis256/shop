// Re-export everything from the canonical lib/email module.
// This file is kept for backwards-compatibility with any remaining imports.
export {
  sendRawEmail as sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendNewsletterWelcome,
  sendEmail as sendTemplateEmail,
} from "../lib/email";
