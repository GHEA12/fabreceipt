// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ReceiptAnchor — FabReceipt snapshot hash registry
/// @notice Anchors the content hash of a FabReceipt snapshot (a block-pinned read of
///         TapeOut contracts on X Layer mainnet) so the published receipt history is
///         tamper-evident: anyone can recompute the hash of a snapshot file and check
///         it was anchored at the recorded time, against the recorded mainnet block.
///         Deployed on X Layer testnet (1952) for the hackathon proof.
contract ReceiptAnchor {
    struct Anchor {
        bytes32 snapshotHash; // keccak256 of the canonical snapshot JSON
        uint256 xlayerBlock; // X Layer mainnet block the snapshot was pinned to
        uint256 anchoredAt; // timestamp of this anchor transaction
        string uri; // where the snapshot JSON is published (repo / dashboard)
    }

    address public owner;
    Anchor[] public anchors;

    event Anchored(uint256 indexed index, bytes32 snapshotHash, uint256 xlayerBlock, string uri);

    constructor() {
        owner = msg.sender;
    }

    function anchor(bytes32 snapshotHash, uint256 xlayerBlock, string calldata uri) external returns (uint256 index) {
        require(msg.sender == owner, "only owner");
        require(snapshotHash != bytes32(0), "empty hash");
        anchors.push(Anchor(snapshotHash, xlayerBlock, block.timestamp, uri));
        index = anchors.length - 1;
        emit Anchored(index, snapshotHash, xlayerBlock, uri);
    }

    function count() external view returns (uint256) {
        return anchors.length;
    }

    function get(uint256 index) external view returns (bytes32, uint256, uint256, string memory) {
        Anchor storage a = anchors[index];
        return (a.snapshotHash, a.xlayerBlock, a.anchoredAt, a.uri);
    }
}
