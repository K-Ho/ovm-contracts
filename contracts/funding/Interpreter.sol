pragma solidity ^0.5.16;
pragma experimental "ABIEncoderV2";


interface Interpreter {
    function interpretOutcomeAndExecuteEffect(
        bytes calldata,
        bytes calldata
    )
        external;
}
