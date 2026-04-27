export const HUB_POSTMARK_INVITE_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You're invited to Hub OS</title>
  <!--[if mso]>
  <style type="text/css">
    table, td { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Outfit:wght@600;700&display=swap');

    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

    .body-bg { background-color: #1C2430; }
    .card-bg { background-color: #263040; }
    .text-main { color: #F0F4F8; }
    .text-secondary { color: #C0CCDA; }
    .text-muted { color: #8D9BB0; }
    .text-pink { color: #FFA3CD; }
    .border-muted { border-color: #334155; }

    .btn-primary {
      background-color: #FFA3CD;
      color: #1C2430 !important;
      font-family: 'DM Sans', Arial, sans-serif;
      font-weight: 700;
      font-size: 16px;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      display: inline-block;
      mso-padding-alt: 0;
    }
    .btn-primary:hover {
      background-color: #FF7AB5;
    }

    .feature-item {
      font-family: 'DM Sans', Arial, sans-serif;
      font-size: 14px;
      color: #C0CCDA;
      line-height: 1.5;
      padding: 6px 0;
    }

    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .card { padding: 24px 20px !important; }
      .logo-text { font-size: 28px !important; }
    }
  </style>
</head>
<body class="body-bg" style="margin: 0; padding: 0; background-color: #1C2430;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #1C2430;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span class="logo-text" style="font-family: 'Outfit', Arial, sans-serif; font-size: 32px; font-weight: 700; color: #F0F4F8; letter-spacing: 0.02em;">
                HUB<span style="color: #FFA3CD;"> OS</span>
              </span>
            </td>
          </tr>

          <tr>
            <td class="card" style="background-color: #263040; border-radius: 12px; padding: 40px 36px; border: 1px solid #334155;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: 'Outfit', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #F0F4F8; line-height: 1.3; padding-bottom: 20px;">
                    You're invited to the {{PROJECT_NAME}}
                  </td>
                </tr>

                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7; padding-bottom: 16px;">
                    Hello hello!
                  </td>
                </tr>

                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7; padding-bottom: 16px;">
                    Well as you know I've been working on this app pretty crazily for the last month. I think I'm in a place where it's ready to be user tested.
                  </td>
                </tr>

                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7; padding-bottom: 24px;">
                    I'm inviting you to a project called <strong style="color: #FFA3CD;">{{PROJECT_NAME}}</strong> where my hope is that we can use the app itself to track the user and bug testing to see what features it's missing. That being said, I would love if you would also just use it for whatever else.
                  </td>
                </tr>
                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7; padding-bottom: 24px;">
                    If you do not already have a Hub OS account, you should also receive a secure account setup email from Keycloak. Complete that first, then come back here.
                  </td>
                </tr>

                <tr>
                  <td style="font-family: 'Outfit', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #F0F4F8; line-height: 1.4; padding-bottom: 12px;">
                    Here's what's built (and hopefully works)
                  </td>
                </tr>

                <tr>
                  <td style="padding-bottom: 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;A home page with all your tasks, events and reminders rolled up
                        </td>
                      </tr>
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;A daily timeline view on your dashboard
                        </td>
                      </tr>
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;Project Lens and Stream views on the homepage
                        </td>
                      </tr>
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;Create projects &mdash; each with its own roll-up across users
                        </td>
                      </tr>
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;A Google Docs-style collaborative editor with drag &amp; drop
                        </td>
                      </tr>
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;Widgets: Calendars, Tasks, Reminders, Kanban, Tables, Files &amp; Quick Thoughts
                        </td>
                      </tr>
                      <tr>
                        <td class="feature-item" style="font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #C0CCDA; line-height: 1.5; padding: 5px 0;">
                          <span style="color: #FFA3CD;">&#9679;</span>&nbsp;&nbsp;Paste YouTube, Spotify, Vimeo or SoundCloud links &mdash; they auto-embed
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-bottom: 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 10px; background-color: #FFA3CD;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{APP_URL}}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" fillcolor="#FFA3CD">
                            <w:anchorlock/>
                            <center style="color:#1C2430;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Join the Pilot</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="{{APP_URL}}" class="btn-primary" style="background-color: #FFA3CD; color: #1C2430; font-family: 'DM Sans', Arial, sans-serif; font-weight: 700; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block;">
                            Join the Pilot
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="border-top: 1px solid #334155; padding-top: 20px; padding-bottom: 16px; font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7;">
                    This has just been me feverishly working and testing all of this stuff so a lot of it might be broken. I know you will let me know if something is systemically or visually broken &mdash; which is why I'm inviting you to this pilot.
                  </td>
                </tr>

                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7; padding-bottom: 24px;">
                    Apart from bugs, I also really want to know what features you wish existed. Invoicing? Personal finance? A different view for your files? A better way to lay out tasks? A different UX flow? I'm here for all of it.
                  </td>
                </tr>

                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #C0CCDA; line-height: 1.7; padding-bottom: 4px;">
                    Looking forward to what you discover!
                  </td>
                </tr>
                <tr>
                  <td style="font-family: 'DM Sans', Arial, sans-serif; font-size: 15px; color: #F0F4F8; line-height: 1.7; padding-top: 12px;">
                    Warmly,<br />
                    <strong>Eshaan</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 16px;">
              <span style="font-family: 'DM Sans', Arial, sans-serif; font-size: 12px; color: #8D9BB0; line-height: 1.5;">
                Sent with love from <a href="{{APP_URL}}" style="color: #FFA3CD; text-decoration: none;">Hub OS</a>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
