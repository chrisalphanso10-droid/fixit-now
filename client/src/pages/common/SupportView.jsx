/**
 * FixIt Now - Help & Support View
 * Conforms to SRS FR-C20, docs/DESIGN.md and docs/PLAN.md Phase 8.
 * Features FAQ accordions (<details>), 24/7 hotline, and ticket submission.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSupportFaqs, submitSupportTicket } from '../../services/supportService';

export default function SupportView({ userRole = 'customer' }) {
  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [faqError, setFaqError] = useState(null);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('service_quality');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null);
  const [formError, setFormError] = useState(null);

  const loadFaqs = useCallback(async () => {
    setLoadingFaqs(true);
    setFaqError(null);
    try {
      const data = await getSupportFaqs();
      setFaqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[SupportView] FAQ load error:', err);
      setFaqError(err.message || 'Failed to load FAQ knowledgebase.');
    } finally {
      setLoadingFaqs(false);
    }
  }, []);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setFormError('Please fill in both the subject and detailed message.');
      return;
    }
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await submitSupportTicket({
        subject: subject.trim(),
        category,
        message: message.trim(),
      });
      setTicketResult(res);
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('[SupportView] Submit ticket error:', err);
      setFormError(err.message || 'Failed to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Top Banner */}
      <div
        className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard"
        style={{ borderRadius: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[var(--theme-border)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 bg-signal inline-block" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-signal">
                HELP DESK &amp; DISPUTE RESOLUTION
              </span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--theme-text-main)]">
              Support &amp; Assistance
            </h1>
          </div>

          <div className="border-2 border-done bg-done text-paper px-3 py-1 font-mono text-xs font-bold uppercase shadow-hard-sm self-start sm:self-auto">
            24/7 ACTIVE DESK
          </div>
        </div>

        <p className="font-mono text-xs sm:text-sm text-[var(--theme-text-soft)] leading-relaxed">
          Need help with an on-site job, OTP verification, direct payment settlement, or partner verification? Our trade desk team is here to assist.
        </p>
      </div>

      {/* Emergency Hotline Banner */}
      <div className="p-4 sm:p-5 border-2 border-signal bg-[var(--theme-surface)] shadow-hard flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
        <div className="space-y-1">
          <span className="font-bold text-signal uppercase tracking-wider block">
            RAPID ON-SITE DISPUTE &amp; SAFETY HELPLINE
          </span>
          <p className="text-[var(--theme-text-soft)]">
            For urgent escalations during active doorstep work orders.
          </p>
        </div>
        <a
          href="tel:+918045678900"
          className="px-4 py-2 bg-signal text-ink border-2 border-ink font-bold uppercase tracking-wider self-start sm:self-auto shadow-hard-sm hover:bg-ink hover:text-signal transition-colors"
        >
          CALL +91 80 4567 8900
        </a>
      </div>

      {/* 2-Column: Ticket Form & FAQs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Support Ticket Submission */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard space-y-4"
          style={{ borderRadius: 0 }}
        >
          <div className="border-b-2 border-[var(--theme-border)] pb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              SUBMIT SUPPORT TICKET
            </span>
          </div>

          {ticketResult && (
            <div className="p-4 border-2 border-done bg-done/10 text-[var(--theme-text-main)] space-y-1 font-mono text-xs animate-fade-in">
              <span className="font-bold text-done uppercase block">
                ✓ Ticket Submitted Successfully
              </span>
              <p>Reference: <span className="font-bold">{ticketResult.ticket_no}</span></p>
              <p className="text-[11px] text-[var(--theme-text-soft)]">
                Our operations team will review your enquiry and update you via in-app notifications.
              </p>
            </div>
          )}

          {formError && (
            <div className="p-3 border-2 border-signal bg-signal/10 font-mono text-xs text-signal">
              [!] {formError}
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="space-y-4 font-mono text-xs">
            <div className="space-y-1">
              <label htmlFor="ticket-category" className="font-bold uppercase text-[var(--theme-text-main)] block">
                Category
              </label>
              <select
                id="ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)]"
              >
                <option value="service_quality">Service Quality &amp; Punctuality</option>
                <option value="billing">Direct Payment &amp; Receipts</option>
                <option value="otp_verification">OTP Verification Issue</option>
                <option value="partner_verification">KYC / Partner Verification</option>
                <option value="app_issue">App Bug / Glitch</option>
                <option value="other">Other Inquiry</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="ticket-subject" className="font-bold uppercase text-[var(--theme-text-main)] block">
                Subject
              </label>
              <input
                id="ticket-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question about on-site UPI receipt"
                className="w-full p-2.5 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="ticket-message" className="font-bold uppercase text-[var(--theme-text-main)] block">
                Detailed Message
              </label>
              <textarea
                id="ticket-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue with order numbers or partner details..."
                className="w-full p-2.5 border-2 border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text-main)] font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full min-h-[46px] uppercase font-mono font-bold text-xs tracking-wider cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Support Ticket →'}
            </button>
          </form>
        </div>

        {/* FAQs Accordion */}
        <div
          className="bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] p-5 sm:p-6 shadow-hard space-y-4"
          style={{ borderRadius: 0 }}
        >
          <div className="border-b-2 border-[var(--theme-border)] pb-3 flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--theme-text-main)]">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <span className="font-mono text-[11px] text-[var(--theme-text-soft)]">
              {faqs.length} articles
            </span>
          </div>

          {loadingFaqs ? (
            <div className="p-8 text-center border border-[var(--theme-border)]">
              <div className="inline-block w-5 h-5 border-2 border-signal border-t-transparent animate-spin mb-2" />
              <p className="font-mono text-xs text-[var(--theme-text-soft)]">LOADING FAQS...</p>
            </div>
          ) : faqError ? (
            <div className="p-4 border-2 border-dashed border-signal text-xs font-mono space-y-2">
              <span className="text-signal font-bold">[!] Failed to load FAQs</span>
              <p className="text-[var(--theme-text-main)]">{faqError}</p>
              <button
                type="button"
                onClick={loadFaqs}
                className="px-3 py-1 border border-ink bg-ink text-paper uppercase font-bold text-[10px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : faqs.length === 0 ? (
            <div className="p-8 text-center font-mono text-xs text-[var(--theme-text-soft)]">
              No FAQ articles available at this time.
            </div>
          ) : (
            <div className="space-y-3 font-mono text-xs">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="border-2 border-[var(--theme-border)] bg-[var(--theme-surface)] group"
                >
                  <summary className="p-3.5 font-bold text-[var(--theme-text-main)] cursor-pointer select-none list-none flex items-center justify-between gap-2 hover:bg-[var(--theme-bg)] transition-colors">
                    <span>{faq.q}</span>
                    <span className="text-signal font-bold group-open:rotate-45 transition-transform shrink-0">
                      +
                    </span>
                  </summary>
                  <div className="p-3.5 pt-0 text-[var(--theme-text-soft)] leading-relaxed border-t border-[var(--theme-border)] mt-2">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
