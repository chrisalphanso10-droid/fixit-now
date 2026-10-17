/**
 * FixIt Now - Support Controller
 * Conforms to docs/SRS.md FR-C20, Section 6 and docs/PLAN.md Phase 8.
 */

import { query } from '../config/db.js';
import { createNotification } from './notification.controller.js';

export async function submitSupportTicket(req, res, next) {
  try {
    const { subject, message, order_number, category = 'General Assistance' } = req.body;
    const userId = req.user?.id;
    const userEmail = req.user?.email || 'Customer';
    const userRole = req.user?.role || 'customer';

    if (!subject?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Ticket subject is required.' });
    }
    if (!message?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Please describe your inquiry or issue.' });
    }

    const ticketNo = `TKT-${Date.now().toString().slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const details = {
      ticket_no: ticketNo,
      user_id: userId,
      role: userRole,
      subject: subject.trim(),
      message: message.trim(),
      order_number: order_number?.trim() || null,
      category,
      status: 'open',
      priority: 'normal',
      created_at: new Date().toISOString(),
    };

    // Log to activity_logs for auditability
    await query(
      `INSERT INTO activity_logs (actor, action, details)
       VALUES ($1, 'SUPPORT_TICKET_CREATED', $2)`,
      [userEmail, JSON.stringify(details)]
    );

    // Create acknowledgement notification
    if (userId) {
      await createNotification({
        recipientType: userRole,
        recipientId: userId,
        title: `Support Ticket ${ticketNo} Received`,
        message: `Your ticket regarding "${subject.trim().slice(0, 40)}" has been logged. Our dispatch team will follow up promptly.`,
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Support ticket registered successfully.',
      data: details,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSupportFaqs(req, res) {
  const faqs = [
    {
      id: 1,
      q: 'How does FixIt Now handle service payments?',
      a: 'Payment is settled directly between you and your assigned partner on-site via Cash or direct UPI upon job completion. FixIt Now takes 0% commission from jobs.',
    },
    {
      id: 2,
      q: 'What is the 6-digit service OTP?',
      a: 'To safeguard your appointment, the customer is issued a 6-digit verification code. Provide this code to the partner when they arrive to officially start work.',
    },
    {
      id: 3,
      q: 'Can I cancel an active booking request?',
      a: 'Yes. You can cancel with an itemized reason before the partner completes the job. The partner is freed immediately for other dispatches.',
    },
    {
      id: 4,
      q: 'How do ratings affect partner assignments?',
      a: 'Partners with high ratings receive priority dispatch ranking when requests are matched within the 2 km neighbourhood radius.',
    },
  ];

  return res.status(200).json({
    status: 'success',
    data: faqs,
  });
}

export default {
  submitSupportTicket,
  getSupportFaqs,
};
