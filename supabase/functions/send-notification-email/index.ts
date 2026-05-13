import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const isAllowed = origin === siteUrl || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (siteUrl || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };
}

interface NotificationPayload {
  to: string;
  subject: string;
  message: string;
  notification_type: string;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { to, subject, message, notification_type } = payload;

    if (!to || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, message" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #1e40af;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .notification-badge {
      display: inline-block;
      padding: 6px 12px;
      background-color: #3b82f6;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .message {
      background-color: white;
      padding: 20px;
      border-radius: 4px;
      border-left: 4px solid #3b82f6;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>WatchTracker Notification</h1>
  </div>
  <div class="content">
    <div class="notification-badge">${notification_type.toUpperCase().replace(/_/g, ' ')}</div>
    <div class="message">
      <p>${message}</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from WatchTracker.</p>
      <p>If you have any questions, please contact your administrator.</p>
    </div>
  </div>
</body>
</html>
    `;

    console.log(`Email notification prepared for ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Type: ${notification_type}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email notification processed",
        details: {
          to,
          subject,
          notification_type,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error processing notification:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Failed to process notification",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
