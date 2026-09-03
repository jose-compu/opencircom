pragma circom 2.0.0;

include "../hashing/poseidon.circom";
include "../comparators.circom";
include "../bitify.circom";
include "../utils.circom";
include "../gates.circom";

// MACI v1 command/message building blocks (composable; not full ProcessMessages).
// Spec: https://maci.pse.dev/docs/v1.2/spec
// Encryption: additive Poseidon keystream; coordinator uses DuplexSponge off-chain in MACI.

/**
 * @title MACICommandPack
 * @notice Pack five 50-bit MACI command fields into p (MACI v1 §2.5).
 * @dev p = cm_i + cm_iv·2^50 + cm_n·2^100 + cm_w·2^150 + cm_id·2^200. Each input range-checked.
 * @custom:input stateIndex cm_i — state leaf index (50 bits).
 * @custom:input voteOption cm_iv — vote option index (50 bits).
 * @custom:input nonce cm_n — action nonce (50 bits).
 * @custom:input voteWeight cm_w — voice credit allocation (50 bits).
 * @custom:input pollId cm_id — poll identifier (50 bits).
 * @custom:output packed p — 250-bit packed command prefix.
 */
template MACICommandPack() {
    signal input stateIndex;
    signal input voteOption;
    signal input nonce;
    signal input voteWeight;
    signal input pollId;
    signal output packed;

    component r0 = StrictNum2Bits(50);
    component r1 = StrictNum2Bits(50);
    component r2 = StrictNum2Bits(50);
    component r3 = StrictNum2Bits(50);
    component r4 = StrictNum2Bits(50);
    r0.in <== stateIndex;
    r1.in <== voteOption;
    r2.in <== nonce;
    r3.in <== voteWeight;
    r4.in <== pollId;

    var pow50 = 1;
    for (var i = 0; i < 50; i++) {
        pow50 = pow50 + pow50;
    }
    var pow100 = pow50 * pow50;
    var pow150 = pow100 * pow50;
    var pow200 = pow150 * pow50;

    packed <== stateIndex
        + voteOption * pow50
        + nonce * pow100
        + voteWeight * pow150
        + pollId * pow200;
}

/**
 * @title MACICommandUnpack
 * @notice Unpack p into five 50-bit MACI command fields (MACI v1 §2.6.1).
 * @dev Inverse of MACICommandPack; p must be in [0, 2^250).
 */
template MACICommandUnpack() {
    signal input packed;
    signal output stateIndex;
    signal output voteOption;
    signal output nonce;
    signal output voteWeight;
    signal output pollId;

    component bits = StrictNum2Bits(50 * 5);
    bits.in <== packed;

    component b0 = Bits2Num(50);
    component b1 = Bits2Num(50);
    component b2 = Bits2Num(50);
    component b3 = Bits2Num(50);
    component b4 = Bits2Num(50);

    for (var i = 0; i < 50; i++) {
        b0.in[i] <== bits.out[i];
        b1.in[i] <== bits.out[i + 50];
        b2.in[i] <== bits.out[i + 2 * 50];
        b3.in[i] <== bits.out[i + 3 * 50];
        b4.in[i] <== bits.out[i + 4 * 50];
    }

    stateIndex <== b0.out;
    voteOption <== b1.out;
    nonce <== b2.out;
    voteWeight <== b3.out;
    pollId <== b4.out;
}

/**
 * @title MACICommandHash
 * @notice Command digest h_cm = poseidon4([p, pubKeyX, pubKeyY, salt]) (MACI v1 §2.5).
 * @custom:input packed Packed command prefix p.
 * @custom:input pubKeyX Public key x-coordinate.
 * @custom:input pubKeyY Public key y-coordinate.
 * @custom:input salt Command salt cm_s.
 * @custom:output hash h_cm for EdDSA signing (off-circuit).
 */
template MACICommandHash() {
    signal input packed;
    signal input pubKeyX;
    signal input pubKeyY;
    signal input salt;
    signal output hash;

    component h = Poseidon(4);
    h.inputs[0] <== packed;
    h.inputs[1] <== pubKeyX;
    h.inputs[2] <== pubKeyY;
    h.inputs[3] <== salt;
    hash <== h.out;
}

/**
 * @title MACISharedKeyHash
 * @notice Bind ECDH shared key k_s = [ks0, ks1] to a single field (MACI v1 §1.10).
 * @dev ks0, ks1 are derived off-circuit via Baby JubJub ECDH; only the hash is used in-circuit.
 * @custom:input ks0 Shared key element 0.
 * @custom:input ks1 Shared key element 1.
 * @custom:output hash poseidon2([ks0, ks1]).
 */
template MACISharedKeyHash() {
    signal input ks0;
    signal input ks1;
    signal output hash;

    component h = Poseidon(2);
    h.inputs[0] <== ks0;
    h.inputs[1] <== ks1;
    hash <== h.out;
}

/**
 * @title MACIMessageKeystream
 * @notice Single keystream block for additive message encryption.
 * @dev keystream = poseidon3([sharedKeyHash, nonce, index]). MACI v1 uses DuplexSponge off-chain.
 */
template MACIMessageKeystream() {
    signal input sharedKeyHash;
    signal input nonce;
    signal input index;
    signal output keystream;

    component h = Poseidon(3);
    h.inputs[0] <== sharedKeyHash;
    h.inputs[1] <== nonce;
    h.inputs[2] <== index;
    keystream <== h.out;
}

/**
 * @title MACIMessageEncrypt
 * @notice Encrypt MACI v1 plaintext t (length 7): ciphertext[i] = t[i] + keystream(i).
 * @dev Plaintext layout: t = [p, pubKeyX, pubKeyY, salt, sigR8x, sigR8y, sigS].
 */
template MACIMessageEncrypt() {
    signal input sharedKeyHash;
    signal input nonce;
    signal input plaintext[7];
    signal output ciphertext[7];

    component ks[7];
    for (var i = 0; i < 7; i++) {
        ks[i] = MACIMessageKeystream();
        ks[i].sharedKeyHash <== sharedKeyHash;
        ks[i].nonce <== nonce;
        ks[i].index <== i;
        ciphertext[i] <== plaintext[i] + ks[i].keystream;
    }
}

/**
 * @title MACIMessageDecrypt
 * @notice Decrypt MACI message: plaintext[i] = ciphertext[i] - keystream(i).
 */
template MACIMessageDecrypt() {
    signal input sharedKeyHash;
    signal input nonce;
    signal input ciphertext[7];
    signal output plaintext[7];

    component ks[7];
    for (var i = 0; i < 7; i++) {
        ks[i] = MACIMessageKeystream();
        ks[i].sharedKeyHash <== sharedKeyHash;
        ks[i].nonce <== nonce;
        ks[i].index <== i;
        plaintext[i] <== ciphertext[i] - ks[i].keystream;
    }
}

/**
 * @title MACIMessageHash
 * @notice Hash encrypted message for on-chain commitment / message tree leaf.
 * @dev messageHash = poseidon7(ciphertext). Coordinator stores MM + ephemeral pubkey off-chain.
 */
template MACIMessageHash() {
    signal input ciphertext[7];
    signal output hash;

    component h = Poseidon(7);
    for (var i = 0; i < 7; i++) {
        h.inputs[i] <== ciphertext[i];
    }
    hash <== h.out;
}

/**
 * @title MACIVoteCommit
 * @notice Commit phase: encrypt MACI v1 command+signature plaintext and bind shared key hash.
 * @dev Builds t = [p, pubKeyX, pubKeyY, salt, sigR8x, sigR8y, sigS], encrypts with sharedKeyHash.
 *      EdDSA sign h_cm off-circuit before encryption. Outputs ciphertext and messageHash.
 * @custom:input stateIndex, voteOption, nonce, voteWeight, pollId — command fields (50-bit each).
 * @custom:input pubKeyX, pubKeyY, salt — public key and salt.
 * @custom:input sigR8x, sigR8y, sigS — EdDSA signature (computed off-circuit over h_cm).
 * @custom:input sharedKeyHash — poseidon2([ks0, ks1]) from ECDH (off-circuit).
 * @custom:output ciphertext[7] Encrypted message.
 * @custom:output messageHash poseidon7(ciphertext) for on-chain publish.
 * @custom:output commandHash h_cm = poseidon4([p, pubKeyX, pubKeyY, salt]).
 */
template MACIVoteCommit() {
    signal input stateIndex;
    signal input voteOption;
    signal input nonce;
    signal input voteWeight;
    signal input pollId;
    signal input pubKeyX;
    signal input pubKeyY;
    signal input salt;
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;
    signal input sharedKeyHash;

    signal output ciphertext[7];
    signal output messageHash;
    signal output commandHash;

    component pack = MACICommandPack();
    pack.stateIndex <== stateIndex;
    pack.voteOption <== voteOption;
    pack.nonce <== nonce;
    pack.voteWeight <== voteWeight;
    pack.pollId <== pollId;

    component cmdHash = MACICommandHash();
    cmdHash.packed <== pack.packed;
    cmdHash.pubKeyX <== pubKeyX;
    cmdHash.pubKeyY <== pubKeyY;
    cmdHash.salt <== salt;
    commandHash <== cmdHash.hash;

    signal plaintext[7];
    plaintext[0] <== pack.packed;
    plaintext[1] <== pubKeyX;
    plaintext[2] <== pubKeyY;
    plaintext[3] <== salt;
    plaintext[4] <== sigR8x;
    plaintext[5] <== sigR8y;
    plaintext[6] <== sigS;

    component enc = MACIMessageEncrypt();
    enc.sharedKeyHash <== sharedKeyHash;
    enc.nonce <== nonce;
    for (var i = 0; i < 7; i++) {
        enc.plaintext[i] <== plaintext[i];
    }
    for (var j = 0; j < 7; j++) {
        ciphertext[j] <== enc.ciphertext[j];
    }

    component msgHash = MACIMessageHash();
    for (var k = 0; k < 7; k++) {
        msgHash.ciphertext[k] <== ciphertext[k];
    }
    messageHash <== msgHash.hash;
}

/**
 * @title MACIVoteDecryptVerify
 * @notice Coordinator-side: verify decrypted MACI vote option is valid for the poll.
 * @dev Decrypt off-circuit (or via MACIMessageDecrypt), then prove voteOption in allowlist,
 *      pollId matches, nonce >= minValidNonce. Unpacks p and checks field consistency.
 * @param n Number of allowed vote options.
 * @custom:input packed Decrypted command prefix p from plaintext[0].
 * @custom:input voteOption, nonce, voteWeight, pollId, stateIndex — unpacked command fields.
 * @custom:input expectedPollId Public poll id from contract.
 * @custom:input minValidNonce Minimum valid nonce from ballot (blt_n + 1 in MACI); constrained to 50 bits.
 * @custom:input allowedVoteOptions[n] Valid vote option indices.
 * @custom:output valid 1 if all checks pass.
 */
template MACIVoteDecryptVerify(n) {
    assert(n >= 1);
    signal input packed;
    signal input voteOption;
    signal input nonce;
    signal input voteWeight;
    signal input pollId;
    signal input stateIndex;
    signal input expectedPollId;
    signal input minValidNonce;
    signal input allowedVoteOptions[n];
    signal output valid;

    component unpack = MACICommandUnpack();
    unpack.packed <== packed;

    component eqState = IsEqual();
    eqState.in[0] <== unpack.stateIndex;
    eqState.in[1] <== stateIndex;

    component eqVote = IsEqual();
    eqVote.in[0] <== unpack.voteOption;
    eqVote.in[1] <== voteOption;

    component eqNonce = IsEqual();
    eqNonce.in[0] <== unpack.nonce;
    eqNonce.in[1] <== nonce;

    component eqWeight = IsEqual();
    eqWeight.in[0] <== unpack.voteWeight;
    eqWeight.in[1] <== voteWeight;

    component eqPoll = IsEqual();
    eqPoll.in[0] <== unpack.pollId;
    eqPoll.in[1] <== pollId;

    component eqExpectedPoll = IsEqual();
    eqExpectedPoll.in[0] <== pollId;
    eqExpectedPoll.in[1] <== expectedPollId;

    // nonce is 50-bit via unpack; minValidNonce is an untrusted public input.
    component strictMinNonce = StrictNum2Bits(50);
    strictMinNonce.in <== minValidNonce;

    component nonceOk = GreaterEqThan(50);
    nonceOk.in[0] <== nonce;
    nonceOk.in[1] <== minValidNonce;

    component allowlist = VoteInAllowlist(n);
    allowlist.vote <== voteOption;
    for (var i = 0; i < n; i++) {
        allowlist.allowedChoices[i] <== allowedVoteOptions[i];
    }

    component allOk = MultiAND(8);
    allOk.in[0] <== eqState.out;
    allOk.in[1] <== eqVote.out;
    allOk.in[2] <== eqNonce.out;
    allOk.in[3] <== eqWeight.out;
    allOk.in[4] <== eqPoll.out;
    allOk.in[5] <== eqExpectedPoll.out;
    allOk.in[6] <== nonceOk.out;
    allOk.in[7] <== allowlist.out;
    valid <== allOk.out;
}
