const fs = require('fs');
const path = 'src/app/layout.tsx';
let code = fs.readFileSync(path, 'utf8');

const injection = `
        <script
          dangerouslySetInnerHTML={{
            __html: \`
              window.onerror = function(msg, url, lineNo, columnNo, error) {
                alert("Error: " + msg + "\\nURL: " + url + "\\nLine: " + lineNo + "\\nCol: " + columnNo + "\\nError obj: " + (error ? error.message : ''));
                return false;
              };
              window.addEventListener('unhandledrejection', function(event) {
                alert("Unhandled promise rejection: " + event.reason);
              });
            \`
          }}
        />
`;

code = code.replace('<body>', '<body>' + injection);
fs.writeFileSync(path, code);
