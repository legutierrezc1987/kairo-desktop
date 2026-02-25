const Database = require('better-sqlite3');
try {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, msg TEXT)');
    const stmt = db.prepare('INSERT INTO test (msg) VALUES (?)');
    stmt.run('hello world');
    const row = db.prepare('SELECT msg FROM test WHERE id = ?').get(1);
    if (row && row.msg === 'hello world') {
        console.log('PASS: better-sqlite3 DB create, insert, query verified');
        process.exit(0);
    } else {
        console.error('FAIL: data mismatch');
        process.exit(1);
    }
} catch (e) {
    console.error('FAIL: ' + e.message);
    process.exit(1);
}
