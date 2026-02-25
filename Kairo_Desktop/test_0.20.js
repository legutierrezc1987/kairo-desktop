const pty = require('node-pty');
const os = require('os');
const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'] || 'cmd.exe';

try {
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env
    });
    let output = '';
    ptyProcess.onData((data) => {
        output += data;
        if (output.includes('hello')) {
            console.log('PASS: PTY spawn and echo verified');
            process.exit(0);
        }
    });
    ptyProcess.write('echo hello\r\n');
    setTimeout(() => {
        console.log('FAIL: Timeout waiting for echo in PTY - output length: ' + output.length);
        process.exit(1);
    }, 2000);
} catch (e) {
    console.error('FAIL: ' + e.message);
    process.exit(1);
}
