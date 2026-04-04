# Contact Email Setup

The contact form backend sends mail from the `johnny-chat` service on Render.

## 618help.com
Set these environment variables on the Render service:

- `CONTACT_TO_EMAIL_MOWING=618help@gmail.com`
- `CONTACT_FROM_EMAIL=618help@gmail.com`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=618help@gmail.com`
- `SMTP_PASS=<Gmail app password>`

## justaskjohnny.com
When you are ready to wire the AI site, add:

- `CONTACT_TO_EMAIL_AI=johnswaffles@gmail.com`

You can keep the same SMTP sender if you want both sites to use the same Gmail account.

## Notes

- The backend chooses the recipient from the contact form `profile` field.
- Mowing submissions route to `CONTACT_TO_EMAIL_MOWING`.
- AI submissions route to `CONTACT_TO_EMAIL_AI`.
- If a profile-specific variable is missing, the backend falls back to `CONTACT_TO_EMAIL`.
