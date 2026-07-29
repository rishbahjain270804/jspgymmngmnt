-- Runs once, on first container start (docker-entrypoint-initdb.d).
--
-- Each test run creates and drops its own `oan_test_*` database so runs never
-- contaminate each other, which needs rights beyond the single app schema.
-- Scoped to the test prefix so this cannot touch production data.
GRANT ALL PRIVILEGES ON `oan\_test\_%`.* TO 'oan'@'%';
FLUSH PRIVILEGES;
