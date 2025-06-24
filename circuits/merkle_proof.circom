pragma circom 2.2.0;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template MerkleProof(depth) {
    signal input leaf;
    signal input root;
    signal input path_elements[depth];
    signal input path_indices[depth];
    signal output is_valid;

    signal cur[depth+1];
    cur[0] <== leaf;
    signal left[depth];
    signal right[depth];
    for (var i = 0; i < depth; i++) {
        path_indices[i] * (path_indices[i] - 1) === 0;
        left[i]  <== cur[i] + path_indices[i] * (path_elements[i] - cur[i]);
        right[i] <== path_elements[i] + path_indices[i] * (cur[i] - path_elements[i]);
        cur[i+1] <== Poseidon(2)([left[i], right[i]]);
    }

    
    is_valid <== IsEqual()([cur[depth], root]);
} 

// component main = MerkleProof(20);