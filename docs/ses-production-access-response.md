# SES Production Access Request — Draft Response

> Copy the section below (between the horizontal rules) and paste it as your
> reply to Amazon Support case.

---

Hello Luis Alfredo,

Thank you for the detailed guidance. Please find all the requested information below.

**Service:** SES Sending Limits

**Region:** ap-southeast-1 (Asia Pacific — Singapore)

**Limit name:** Desired Daily Sending Quota

**New limit value:** 1,000 emails/day

**Mail Type:** Transactional and System Notifications

**Website URL:** https://siutindei.lx-software.com

---

### Use Case Description

We operate **Siu Tin Dei** (https://siutindei.lx-software.com), a children's activities discovery platform serving families in Hong Kong. The platform lets parents search for after-school activities (classes, workshops, camps) and allows activity providers to manage their listings through an admin console.

We use Amazon SES exclusively for **transactional** and **system notification** emails. We do **not** send marketing, promotional, or bulk emails of any kind. Our email categories are:

1. **Passwordless authentication (transactional):** When a user signs in, our Cognito custom-auth flow generates a one-time passcode (OTP) and sends it to the user's verified email address via SES. This is initiated only by the user themselves as part of the sign-in process. Sender: `hello@lx-software.com`.

2. **Ticket and request notifications to administrators (system notification):** When a user submits a manager access request, an organization suggestion, or feedback, an asynchronous processor (Lambda triggered via SNS → SQS) sends a notification email to our internal support team. Sender: `no-reply@lx-software.com`. Recipient: `support@lx-software.com` (internal only).

3. **Ticket decision notifications to users (transactional):** When an administrator approves or declines a submitted request, suggestion, or feedback item, the platform sends a one-time notification to the user who originally submitted it. Sender: `no-reply@lx-software.com`.

Estimated volume is modest — we anticipate fewer than 200 emails per day during normal operation and are requesting a 1,000/day quota to accommodate growth.

---

### Compliance with AWS Service Terms and AUP

- We send only transactional and system-notification emails that are directly triggered by user actions within our platform. We do not send unsolicited, bulk, or marketing emails.
- All email content is relevant to the recipient's specific action (sign-in code, status update on their own submission). We do not include advertising or promotional material in any email.
- We do not purchase, rent, or harvest email lists. The only email addresses in our system belong to users who have signed up through our Cognito-backed authentication flow and verified their email address.
- Our sender identities (`hello@lx-software.com`, `no-reply@lx-software.com`) are verified in SES, and we use IAM policies to restrict which Lambda functions can send from each address.
- We comply with all applicable anti-spam legislation, including CAN-SPAM and GDPR (our user base is primarily in Hong Kong but we adhere to international standards).

---

### How We Ensure Recipients Have Requested Our Mail

All of our emails fall into two categories, both of which are user-initiated:

1. **Authentication emails:** Sent only when a user actively clicks "Sign In" and requests an OTP code. The email address is verified during Cognito account creation. No user receives an authentication email without explicitly initiating the sign-in process.

2. **Ticket/request notifications:** Sent only to users who have submitted a request, suggestion, or feedback through the platform. The notification is a direct response to their own action. Internal admin notifications go only to our own support mailbox.

We do not maintain mailing lists, do not send newsletters, and do not send emails to users who have not performed a specific action that triggers the email.

---

### Bounce and Complaint Handling Process

We have implemented the following mechanisms:

1. **Architecture-level resilience:** Our email-sending pipeline uses an asynchronous SNS → SQS → Lambda architecture with automatic retries (3 attempts) and a dead-letter queue (DLQ) for messages that fail processing. This ensures transient delivery failures are retried gracefully.

2. **CloudWatch monitoring:** We have a CloudWatch alarm configured on the DLQ that triggers when messages land in it, alerting our team to investigate delivery failures promptly.

3. **Structured logging:** All email-send operations are logged with structured JSON logging (including request IDs for correlation). Both successful sends and failures are recorded and can be traced end-to-end.

4. **Bounce handling:** If a send fails (hard bounce), the error is logged and the message moves to the DLQ after retries are exhausted. We will investigate the cause, and for hard bounces (invalid addresses), we will flag the address to prevent repeated delivery attempts. Since our recipients are verified Cognito users, hard bounces should be extremely rare.

5. **Complaint handling:** We will configure SES notifications (via SNS) for complaints and bounces. Any address that generates a complaint will be suppressed from future sends. Given that our emails are exclusively transactional responses to user-initiated actions, we expect complaint rates to be negligible.

6. **SES account-level suppression list:** We will enable the SES account-level suppression list to automatically prevent sending to addresses that have previously bounced or complained.

---

We are happy to provide any additional information or clarification. Thank you for reviewing our request.

Best regards,
LX Software

---

> **Note:** Before submitting, review and personalize the sign-off with your
> actual name. You may also want to adjust the daily quota number if your
> estimates have changed.
