pragma circom 2.0.0;

include "../../circuits/comparators.circom";

template AgeThresholdProofTest() {
    signal input birthYear;
    signal input currentYear;
    signal input minAge;
    signal output valid;
    component atp = AgeThresholdProof(32);
    atp.birthYear <== birthYear;
    atp.currentYear <== currentYear;
    atp.minAge <== minAge;
    valid <== atp.valid;
}

component main = AgeThresholdProofTest();
