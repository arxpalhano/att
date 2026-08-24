/**
 * Envio de e-mail via Amazon SES v2 (identidade de domínio `archtechtour.com`,
 * região us-east-1). Usado pelo agente Argus Watchtower.
 *
 * ATENÇÃO: a conta SES ainda está em SANDBOX — só é possível enviar para
 * endereços/domínios verificados. `@archtechtour.com` está coberto pela
 * identidade de domínio; outros destinatários precisam ser verificados
 * individualmente (ver PORTAL.md).
 */
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

function getSes(): SESv2Client {
  return new SESv2Client({ region: process.env.SES_REGION || process.env.APP_AWS_REGION || "us-east-1" });
}

export async function sendEmail(opts: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await getSes().send(new SendEmailCommand({
    FromEmailAddress: opts.from,
    Destination: { ToAddresses: opts.to },
    Content: {
      Simple: {
        Subject: { Data: opts.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: opts.text, Charset: "UTF-8" },
          Html: { Data: opts.html, Charset: "UTF-8" },
        },
      },
    },
  }));
}
