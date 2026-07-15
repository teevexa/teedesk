/**
 * TeeDesk embeddable widget entry point.
 *
 * Usage on any website:
 *   <script
 *     src="https://your-teedesk-domain.com/widget.js"
 *     data-tenant-id="YOUR_TENANT_ID"
 *     data-api-url="https://your-teedesk-domain.com"
 *     data-primary-color="#6366f1"    (optional)
 *     data-position="bottom-right"    (optional: bottom-right | bottom-left)
 *   ></script>
 *
 * The widget mounts into an isolated shadow DOM so host-page styles never leak in.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Widget } from './Widget';

function boot() {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector('script[data-tenant-id]');

  const tenantId = script?.getAttribute('data-tenant-id') ?? '';
  const apiUrl =
    script?.getAttribute('data-api-url') ??
    (script?.src ? new URL(script.src).origin : 'http://localhost:8000');
  const primaryColor = script?.getAttribute('data-primary-color') ?? '#6366f1';
  const position =
    (script?.getAttribute('data-position') as 'bottom-right' | 'bottom-left') ?? 'bottom-right';

  if (!tenantId) {
    console.warn('[TeeDesk] data-tenant-id is required. Widget not loaded.');
    return;
  }

  // Host element
  const host = document.createElement('div');
  host.id = 'teedesk-widget-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;';
  document.body.appendChild(host);

  // Shadow DOM — style isolation
  const shadow = host.attachShadow({ mode: 'open' });
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(
    <React.StrictMode>
      <Widget
        tenantId={tenantId}
        apiUrl={apiUrl}
        primaryColor={primaryColor}
        position={position}
      />
    </React.StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
