"use client";

import Script from "next/script";

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

type Grecaptcha = {
  render: (container: string | HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => number;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

export default function RecaptchaField({ action }: { action: string }) {
  if (!siteKey) {
    return <input type="hidden" name="recaptcha_token" value={`dev-recaptcha-${action}`} />;
  }

  const elementId = `recaptcha-${action}`;

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          const element = document.getElementById(elementId);
          if (element && window.grecaptcha && !element.dataset.rendered) {
            window.grecaptcha.render(element, {
              sitekey: siteKey,
              callback: (token) => {
                const input = document.querySelector<HTMLInputElement>(`input[data-recaptcha-input="${elementId}"]`);
                if (input) input.value = token;
              },
            });
            element.dataset.rendered = "true";
          }
        }}
      />
      <div id={elementId} />
      <input data-recaptcha-input={elementId} type="hidden" name="recaptcha_token" required />
    </>
  );
}
