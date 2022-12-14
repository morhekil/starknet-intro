import fs from "fs";
import {
  Account,
  Contract,
  defaultProvider,
  ec as EC,
  json,
  uint256,
} from "starknet";

import { shortStringToBigInt, toUint256WithFelts } from "./starkUtils.js";

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
console.log("Config", config);

const starkKeyPair = getKeyPair();
const starkKeyPub = EC.getStarkKey(starkKeyPair);
console.log("Stark key pair:", starkKeyPub);

// check if we have private key saved in stark_key.priv file,
// if we do - read it, otherwise - automatically generate new
// keypair
function getKeyPair() {
  if (config.privateKey) {
    // read private key from a file and return keypair
    const privateKey = config.privateKey;
    return EC.getKeyPair(privateKey);
  }

  // generate new keypair and save its private key to a file
  const starkKeyPair = EC.genKeyPair();
  const starkKeyPriv = starkKeyPair.getPrivate("hex");
  console.log(`Generated private key: 0x${starkKeyPriv}`);

  // add private key to the config
  config.privateKey = `0x${starkKeyPriv}`;
  return starkKeyPair;
}

const getERC20 = () => {
  const compiledErc20 = json.parse(
    fs.readFileSync("./contracts/ERC20.json").toString("ascii")
  );
  const erc20ABI = compiledErc20.abi;
  const erc20 = new Contract(erc20ABI, config.erc20Address, defaultProvider);
  return erc20;
};

const deployAccount = async () => {
  console.log("Deploying Account contract...");

  const compiledAccount = json.parse(
    fs.readFileSync("./contracts/Account.json").toString("ascii")
  );

  const accountResponse = await defaultProvider.deployContract({
    contract: compiledAccount,
    constructorCalldata: [starkKeyPub],
    addressSalt: starkKeyPub,
  });

  console.log("New account address:", accountResponse.contract_address);
  console.log("Transaction hash:", accountResponse.transaction_hash);

  // add to config
  config.accountAddress = accountResponse.contract_address;

  console.log("waiting for transaction to be mined...");
  await defaultProvider.waitForTransaction(accountResponse.transaction_hash);
  console.log("transaction mined");
};

const deployERC20 = async () => {
  console.log("Deploying ERC20 contract...");

  const compiledErc20 = json.parse(
    fs.readFileSync("./contracts/ERC20.json").toString("ascii")
  );
  console.log("Deploying ERC20 contract...");
  const name = shortStringToBigInt("ING$"); // name as Cairo short string
  const symbol = shortStringToBigInt("ING$"); // symbol as Cairo short string
  const decimals = BigInt(18); // decimals as felt
  const owner = BigInt(config.accountAddress); // owner address as felt

  // might work as just uint256.bnToUint256("1000000")?
  const cap = toUint256WithFelts("1000000"); // supply cap as Uint256 (with felts)

  const constructorCalldata = [name, symbol, decimals, owner, cap].flat();
  console.log("constructorCalldata:", constructorCalldata);
  const erc20Response = await defaultProvider.deployContract({
    contract: compiledErc20,
    constructorCalldata,
  });
  console.log("ERC20 response", erc20Response);

  // add to config
  config.erc20Address = erc20Response.contract_address;

  console.log("Waiting for Tx to be Accepted on Starknet...");
  await defaultProvider.waitForTransaction(erc20Response.transaction_hash);
  console.log("done");
};

const mint = async (address, amount) => {
  console.log(`Minting ${amount} tokens to ${address}...`);

  const erc20 = getERC20();

  const account = new Account(
    defaultProvider,
    config.accountAddress,
    getKeyPair()
  );
  console.log("account", account);
  erc20.connect(account);

  const cairoAmount = uint256.bnToUint256(amount);
  const response = await erc20.mint(address, cairoAmount);

  console.log("Mint response", response);
  console.log("Waiting for Tx to be Accepted on Starknet - Minting...");
  await defaultProvider.waitForTransaction(response.transaction_hash);
  console.log("done");
};

const transfer = async(receiver, amount) => {
  console.log(`Transfering ${amount} tokens to ${receiver}...`);
  const erc20 = getERC20();

  const account = new Account(
    defaultProvider,
    config.accountAddress,
    getKeyPair()
  );
  console.log("account", account);
  erc20.connect(account);
  const cairoAmount = uint256.bnToUint256(amount);
  const response = await erc20.transfer(receiver, cairoAmount);

  console.log("Transfer response", response);
  console.log("Waiting for Tx to be Accepted on Starknet - Transfering...");
  await defaultProvider.waitForTransaction(response.transaction_hash);
  console.log("done");

}

const checkBalance = async (address) => {
  const erc20 = getERC20();
  console.log(`Calling StarkNet for balance of ${address}...`);
  const response = await erc20.balanceOf(address);

  console.log("response is", response);
  console.log(
    `account Address ${address} has a balance of:`,
    uint256.uint256ToBN(response.balance).toString()
  );
};

try {
  // await deployAccount();
  // await deployERC20();
  // await mint(
  //   config.playerAddress,
  //   "2500"
  // );
  // await mint(
  //   config.accountAddress,
  //   "2500"
  // );
  await checkBalance(config.playerAddress);
  await checkBalance(config.accountAddress);
  await transfer(config.playerAddress, "300")
  await checkBalance(config.playerAddress);
  await checkBalance(config.accountAddress);
} catch (err) {
  console.error(err);
}
