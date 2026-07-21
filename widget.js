/**
 * DEPRECATED — the embeddable bubble widget has been retired in favor of
 * the full-page chat site (index.html / "/"), served by this same
 * server.js. This file is kept only so old <script src="widget.js">
 * embeds on external pages don't hard-fail; it does nothing.
 *
 * If you still have a <script src=".../widget.js"> tag on an external
 * site, remove it and link to this server's root URL ("/") instead.
 */
(function () {
  console.warn(
    '[Ticketleo] widget.js is deprecated and no longer renders a chat bubble. ' +
    'The support chat is now a full-page site — remove this <script> tag and ' +
    'link users to the site root ("/") instead.'
  );
})();
