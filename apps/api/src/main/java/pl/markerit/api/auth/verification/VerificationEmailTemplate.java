package pl.markerit.api.auth.verification;

final class VerificationEmailTemplate {
    private VerificationEmailTemplate() {}

    static String subject(boolean polish) {
        return polish ? "Potwierdź adres e-mail — markerIt" : "Verify your email — markerIt";
    }

    static String text(String code, boolean polish) {
        return polish
                ? "Cześć!\n\nTwój kod potwierdzający markerIt to: " + code + "\nKod jest ważny przez 10 minut. Jeśli to nie Ty zakładałeś(-aś) konto, zignoruj tę wiadomość."
                : "Hello!\n\nYour markerIt verification code is: " + code + "\nThis code expires in 10 minutes. If you did not create an account, you can ignore this email.";
    }

    static String html(String code, boolean polish) {
        String title = polish ? "Potwierdź swój adres e-mail" : "Verify your email address";
        String intro = polish
                ? "Dziękujemy za dołączenie do markerIt. Wpisz ten kod w aplikacji, aby potwierdzić adres e-mail i dokończyć rejestrację."
                : "Thanks for joining markerIt. Enter this code in the app to verify your email address and finish setting up your account.";
        String expiry = polish ? "Kod jest ważny przez 10 minut." : "This code is valid for 10 minutes.";
        String ignore = polish
                ? "Jeśli nie zakładałeś(-aś) konta w markerIt, zignoruj tę wiadomość. Twoje konto nie zostanie aktywowane bez potwierdzenia."
                : "If you did not create a markerIt account, you can ignore this email. Your account will not be activated unless the address is verified.";
        return """
                <!doctype html><html lang="%s"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
                <body style="margin:0;background:#f4f5f7;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171923">
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="padding:40px 16px;background:#f4f5f7"><tr><td align="center">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e7e8ec;border-radius:20px;overflow:hidden">
                      <tr><td style="padding:28px 36px 18px"><div style="font-size:20px;font-weight:750;letter-spacing:-.04em;color:#171923">marker<span style="color:#6d5dfc">It</span></div></td></tr>
                      <tr><td style="padding:14px 36px 36px"><div style="width:42px;height:4px;border-radius:4px;background:#6d5dfc;margin-bottom:24px"></div>
                        <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;letter-spacing:-.03em">%s</h1>
                        <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#545968">%s</p>
                        <div style="padding:22px 18px;background:#f7f6ff;border:1px solid #e9e6ff;border-radius:14px;text-align:center">
                          <div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#77738f;margin-bottom:9px">markerIt</div>
                          <div style="font-size:34px;line-height:1.2;font-weight:750;letter-spacing:.28em;color:#28233f">%s</div>
                        </div>
                        <p style="margin:16px 0 0;font-size:13px;color:#6b7080">%s</p>
                        <div style="height:1px;background:#ececf0;margin:28px 0 18px"></div>
                        <p style="margin:0;font-size:12px;line-height:1.6;color:#858997">%s</p>
                      </td></tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:11px;color:#9699a4">markerIt · project feedback, clearly placed</p>
                  </td></tr></table>
                </body></html>
                """.formatted(polish ? "pl" : "en", title, intro, code, expiry, ignore);
    }
}
