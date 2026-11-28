// Dev-network workaround for IPv6-only / NAT64 networks.
//
// On a NAT64/DNS64 network (common on some ISPs, mobile hotspots and VPNs),
// hosts like api.cloudinary.com resolve to BOTH non-routable native IPv4
// addresses AND working NAT64 IPv6 addresses (the 64:ff9b::/96 prefix). Node's
// "Happy Eyeballs" (autoSelectFamily) then stalls racing the dead IPv4 addresses,
// so outbound HTTPS — e.g. KYC image uploads — fails with Cloudinary's own
// client-side "Request Timeout" (ETIMEDOUT), regardless of the image size.
//
// Opt in LOCALLY by setting NET_IPV6FIRST=1 in backend/.env: this prefers IPv6
// and disables Happy Eyeballs so Node connects over the address that works.
// Leave it UNSET in production (Render is IPv4/dual-stack and must not be forced).
import dns from 'node:dns';
import net from 'node:net';

if (process.env.NET_IPV6FIRST === '1') {
  try {
    dns.setDefaultResultOrder('ipv6first');
    net.setDefaultAutoSelectFamily?.(false);
    console.log('[net] NET_IPV6FIRST=1 → ipv6first + Happy Eyeballs off (NAT64 dev workaround)');
  } catch (err) {
    console.warn('[net] could not apply NET_IPV6FIRST workaround:', err?.message);
  }
}
