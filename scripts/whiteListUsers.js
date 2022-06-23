const { ethers } = require("hardhat");
const hre = require("hardhat");
const path = require("path");
const filePath = path.join(__dirname, "./FinalBLKDAirdrop.csv")
const csv = require('csvtojson');

const Web3 = require('web3')
let web3 = new Web3("https://mainnet.infura.io/v3/6e516a50f8404231bcb030ce93cf466f");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("deployer", deployer.address);

    const claimerAddress = "";
    const blkd = ""
    let addresses = []
    let amountsInWei = []

    const fileJson = await csv().fromFile(filePath)

    for (const elem of fileJson) {
        let address = elem.receiver.toString()
        if (address.includes(".")){
            address = await web3.eth.ens.getAddress(elem.receiver.toString())
        }
        addresses.push(address);
        let amountWei = elem.amount.toString() + "000000000";
        amountsInWei.push(amountWei)
    }

    addresses = sliceIntoChunks(addresses, 500)
    amountsInWei = sliceIntoChunks(amountsInWei, 500)

    const Claimer = await ethers.getContractFactory("BlackDAOClaimer");
    const claimer = await Claimer.deploy(blkd);
    await claimer.deployed();
    console.log("Claimer deployed: ", claimer.address);

    // const claimer = await ethers.getContractAt("BlackDAOClaimer", claimerAddress);

    for(let i = 0; i < addresses.length; i++){
        const completed = await claimer.addToWhitelistBatch(addresses[i],amountsInWei[i]);
        const receipt = await completed.wait();
        const gasUsed = receipt.gasUsed;
        console.log("gasUsed", gasUsed);
        console.log("index:", i, "/", addresses.length);
    }

}

function sliceIntoChunks(arr, chunkSize) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
