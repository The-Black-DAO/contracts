const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const path = require("path");
const filePath = path.join(__dirname, "./BLKDAirdrop.csv")
const csv = require('csvtojson');
const fs = require('fs');

const Web3 = require('web3')
let web3 = new Web3("https://mainnet.infura.io/v3/6e516a50f8404231bcb030ce93cf466f");

async function main() {

    let addresses = []
    let amountsInWei = []

    const fileJson = await csv().fromFile(filePath)

    for (const elem of fileJson) {
        let address = elem.receiver.toString()
        if (address.includes(".")) {
            address = await web3.eth.ens.getAddress(elem.receiver.toString())
        }
        addresses.push(address);
        let amountWei = elem.amount.toString() + "000000000";
        amountsInWei.push(amountWei)
    }

    // console.log("Addresses", addresses);
    // console.log("AmountsInWei", amountsInWei);

    let leaves = []

    for (let i = 0; i < addresses.length; i++) {
        leaves.push(web3.utils.soliditySha3( {t: 'address', v: addresses[i]}, {t: 'uint256',v: amountsInWei[i]} ));
    }

    // console.log("Leaves", leaves)

    let merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    let rootHash = merkleTree.getRoot().toString('hex');

    // console.log("TREE: ", merkleTree.toString());
    // console.log("ROOT: ", rootHash);

    ///////////////////////////////////////////

    const proofs = []

    for (let i = 0; i < addresses.length; i++){

        let hashedData = web3.utils.soliditySha3({t: 'address', v: addresses[i]}, {t: 'uint256', v: amountsInWei[i]});
        let proof = merkleTree.getHexProof(hashedData);
    
        console.log("Proof for: ", addresses[i],"    ",proof);

        proofs.push({ address: addresses[i], value: amountsInWei[i], proof: proof})

        let v = merkleTree.verify(proof, hashedData, rootHash);
        console.log("V: ", v);
    }

    fs.appendFileSync(path.join(__dirname,'./proofs.json'), '[')

    for (const elem of proofs) {
        fs.appendFileSync(path.join(__dirname,'./proofs.json'), JSON.stringify(elem))
        fs.appendFileSync(path.join(__dirname,'./proofs.json'), ',')
    }

    fs.appendFileSync(path.join(__dirname,'./proofs.json'), ']')

}

main();