/**
 * Plain HTML email templates for verification and password reset.
 */

export function buildVerificationEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #2563eb;">请确认您的邮箱地址</h2>
  <p>您已注册 Event Contract，请点击下方链接确认您的邮箱：</p>
  <p><a href="${verifyUrl}" style="color: #2563eb; text-decoration: underline;">${verifyUrl}</a></p>
  <p style="color: #64748b; font-size: 14px;">此链接 24 小时内有效。若您未注册，请忽略此邮件。</p>
</body>
</html>
`.trim();
}

export function buildPasswordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #2563eb;">重置密码</h2>
  <p>您请求了密码重置，请点击下方链接设置新密码：</p>
  <p><a href="${resetUrl}" style="color: #2563eb; text-decoration: underline;">${resetUrl}</a></p>
  <p style="color: #64748b; font-size: 14px;">此链接 1 小时内有效。若您未请求重置，请忽略此邮件。</p>
</body>
</html>
`.trim();
}
