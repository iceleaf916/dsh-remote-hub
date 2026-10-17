import assert from "node:assert/strict";
import test from "node:test";
import { parseSshConfig, validateSshAlias } from "../lib/host/ssh.js";

test("SSH aliases reject option and shell injection forms", () => {
	assert.equal(validateSshAlias("office-pc"), "office-pc");
	assert.throws(() => validateSshAlias("-oProxyCommand=touch"), TypeError);
	assert.throws(() => validateSshAlias("office-pc; touch /tmp/x"), TypeError);
	assert.throws(() => validateSshAlias("office pc"), TypeError);
});

test("OpenSSH resolved configuration extracts host, user and port", () => {
	assert.deepEqual(parseSshConfig(`
	host office-pc
	user dev
	port 2222
	HostName 192.0.2.10
	identityfile /home/dev/.ssh/id_ed25519
	`), {
		hostName: "192.0.2.10",
		user: "dev",
		port: 2222
	});
});
