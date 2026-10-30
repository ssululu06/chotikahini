/**
 * Centralized ad configuration for all website ad slots.
 * Ensures consistent rendering via isolated srcDoc iframes across the application.
 */

export const ADSTERRA_300x250_KEY = "44d3e4fc350431e5d8e9b91228e5e950";
export const ADSTERRA_160x300_KEY = "6260e8c86ed208a85ee54db4c01e5106";

export function createAdsterraSrcDoc(
  key: string,
  width: number,
  height: number,
  host = "www.highrevenueformat.com",
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${key}',
      'format' : 'iframe',
      'height' : ${height},
      'width' : ${width},
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="https://${host}/${key}/invoke.js"></script>
</body>
</html>`;
}

export const AD_300x250_HTML = createAdsterraSrcDoc(
  ADSTERRA_300x250_KEY,
  300,
  250,
  "www.highrevenueformat.com",
);

export const AD_160x300_HTML = createAdsterraSrcDoc(
  ADSTERRA_160x300_KEY,
  160,
  300,
  "www.highperformanceformat.com",
);
