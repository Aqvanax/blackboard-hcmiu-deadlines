// Bookmarklet: mở trang Calendar của Blackboard rồi bấm bookmark này là có nút.
// Cách cài: bookmark mới => dán DÒNG DƯỚI ĐÂY (bắt đầu bằng javascript:) vào trường URL.

javascript: (function () {
  var s = document.createElement('script');
  s.src =
    'https://YOUR-USERNAME.github.io/blackboard-hcmiu-deadlines/blackboard-deadlines.user.js';
  document.body.appendChild(s);
})();
