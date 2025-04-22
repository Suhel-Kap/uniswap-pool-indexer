import {END_BLOCK, globalMutex, LP_TOKENS, START_BLOCK} from "./consts";
import {type Context} from "ponder:registry"
import schema from "ponder:schema";
import {Address, TransactionReceipt} from "viem";
import {getContractCreationInfo} from "./tokenUtils";
import {ContractCreationInfo} from "./types";

const tokens = schema.tokens;
const newContractsDeployed = schema.newContractsDeployed;

export async function storeLpTokens(context: Context) {
    await globalMutex.runExclusive(async () => {
        const {db} = context;

        for (const [ticker, token] of Object.entries(LP_TOKENS)) {
            try {
                const tokenCreationInfo: ContractCreationInfo | null
                    = await getContractCreationInfo(token.address as Address);

                await db.insert(tokens).values({
                    name: token.name,
                    ticker: ticker,
                    contractAddress: token.address as Address,
                    decimals: token.decimals,
                    creationBlock: tokenCreationInfo?.blockNumber || -1n,
                    creationTxnHash: tokenCreationInfo?.txHash || null,
                    deployerAddress: tokenCreationInfo?.contractCreator || null,
                }).onConflictDoNothing();
            } catch (e) {
                console.error(`Error inserting ${ticker}:`, e);
            }
        }
    });
}

export async function storeNewContractsDeployed(context: Context) {
    await globalMutex.runExclusive(async () => {
        const {client, db} = context;

        const count = await db.sql.$count(newContractsDeployed);

        if (count > 0) {
            console.log("New entries already exist in db, skipping...");
            return;
        }

        let endBlock: bigint | string = END_BLOCK;
        if (endBlock === "latest") {
            endBlock = await client.request({
                method: "eth_blockNumber"
            });
        }
        for (let i = START_BLOCK; i < BigInt(endBlock); i++) {
            const block = await client.getBlock({
                blockNumber: BigInt(i),
                includeTransactions: true
            });

            if (block) {
                const contractCreationTxns = block.transactions.filter((tx) => tx.to === null);

                for (const tx of contractCreationTxns) {
                    // Get transaction receipt to find the contract address
                    const receipt: TransactionReceipt = await client.getTransactionReceipt({
                        hash: tx.hash,
                    });

                    if (receipt && receipt.contractAddress) {
                        console.log("Receipt", receipt.contractAddress);
                        const result = await db.insert(newContractsDeployed).values({
                            deployerAddress: tx.from,
                            creationBlock: tx.blockNumber!,
                            creationTxnHash: tx.hash,
                            contractAddress: receipt.contractAddress!,
                        });
                        console.log("Result", result);
                        console.log(`Contract created: ${receipt.contractAddress}\n${tx.hash}, block: ${tx.blockNumber}, ${receipt.contractAddress}`);
                    }
                }
            } else {
                console.log(`Block ${i} not found`);
            }
        }
    });
}