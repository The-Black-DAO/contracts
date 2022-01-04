import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    CONTRACTS,
    EPOCH_LENGTH_IN_BLOCKS,
    FIRST_EPOCH_TIME,
    FIRST_EPOCH_NUMBER,
} from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const blkdDeployment = await deployments.get(CONTRACTS.blkd);
    const sBlkdDeployment = await deployments.get(CONTRACTS.sBlkd);
    const gBlkdDeployment = await deployments.get(CONTRACTS.gBlkd);

    await deploy(CONTRACTS.staking, {
        from: deployer,
        args: [
            blkdDeployment.address,
            sBlkdDeployment.address,
            gBlkdDeployment.address,
            EPOCH_LENGTH_IN_BLOCKS,
            FIRST_EPOCH_NUMBER,
            FIRST_EPOCH_TIME,
            authorityDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.staking, "staking"];
func.dependencies = [CONTRACTS.blkd, CONTRACTS.sBlkd, CONTRACTS.gBlkd];

export default func;
