<?php
require_once __DIR__ . '/../legal_lib.php';
$meta = [
    'path' => '/en/cookie-policy/',
    'title' => 'Cookie Policy | Opia Coffee Co.',
    'description' => 'Opia Coffee Co. cookie policy: we only use the cookies and browser storage the site needs to work. No advertising or tracking cookies.',
    'body' => 'page-legal',
    'breadcrumb' => [['Home', '/en/'], ['Cookie Policy', '/en/cookie-policy/']],
    'priority' => '0.3',
];
ob_start();
echo legal_open('Cookie Policy', 'We only use the cookies and browser storage this site needs to work. There are no advertising or tracking cookies.');
?>
<h2>What is a cookie?</h2>
<p>Cookies are small text files saved on your device when you visit a website. Browser storage (localStorage, sessionStorage) can be used for the same purpose; this policy covers all of them.</p>

<h2>What we use</h2>
<div class="tablewrap">
<table class="ctable">
  <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead>
  <tbody>
    <tr><td><code>opia_consent</code></td><td>Essential (cookie and local storage)</td><td>Remembers your cookie choice.</td><td>12 months</td></tr>
    <tr><td><code>opia_table</code>, <code>opia_cart_*</code></td><td>Essential (session storage)</td><td>Your table code and basket for QR ordering. Deleted when you close the tab.</td><td>Session</td></tr>
    <tr><td><code>opia_orders_*</code></td><td>Essential (local storage)</td><td>The numbers of your orders, to show their status.</td><td>12 hours</td></tr>
    <tr><td><code>PHPSESSID</code></td><td>Essential</td><td>Staff admin panel session only. Not set for visitors.</td><td>Session</td></tr>
    <?php if (analytics_on()): ?><tr><td><code>_ga</code>, <code>_ga_*</code></td><td>Statistics</td><td>Anonymous visit statistics. Only loaded with your consent.</td><td>Up to 2 years</td></tr><?php endif; ?>
    <tr><td>OpenStreetMap</td><td>Third party</td><td>The map only loads if you press “Load map”.</td><td>Set by the provider</td></tr>
  </tbody>
</table>
</div>
<?php if (!analytics_on()): ?><p>We currently use no statistics, advertising or tracking cookies. If we add any in the future, they will only run with your explicit consent.</p><?php endif; ?>

<h2>Consent</h2>
<p>Essential cookies and storage are needed for the site and QR ordering to work. Statistics and third-party content only run with your consent; declining does not affect your use of the site.</p>

<h2>Manage your choice</h2>
<ul>
  <li>Use the <button type="button" class="linkbtn" data-consent-open>Cookie Settings</button> link at the bottom of any page to change your choice.</li>
  <li>You can delete or block cookies and site data in your browser settings.</li>
</ul>

<h2>More information</h2>
<p><a href="/en/personal-data-notice/">Personal Data Notice</a> and <a href="/en/privacy-policy/">Privacy Policy</a>.</p>
<?php
echo legal_close();
$content = ob_get_clean();
