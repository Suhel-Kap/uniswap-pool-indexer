import {Address} from "viem";
import {Erc20Abi} from "../../abis/Erc20Abi";
import {Context} from "ponder:registry";
import schema from "ponder:schema";
import {eq} from "ponder";
import {ContractCreationInfo, TokenInfo} from "./types";
import axios from "axios";

export async function getTargetTokenInfo(context: Context, tokenAddress: Address): Promise<TokenInfo> {
    try {
        const targetTokenContract = {
            address: tokenAddress,
            abi: Erc20Abi,
        } as const;

        const results = await context.client.multicall({
            contracts: [
                { ...targetTokenContract, functionName: "name" },
                { ...targetTokenContract, functionName: "symbol" },
                { ...targetTokenContract, functionName: "decimals" },
                { ...targetTokenContract, functionName: "totalSupply" }
            ]
        });

        return {
            address: tokenAddress,
            name: results[0].result ? String(results[0].result) : "Unknown",
            ticker: results[1].result ? String(results[1].result) : "UNK",
            decimals: results[2].result ? parseInt(results[2].result.toString()) : 18,
            totalSupply: results[3].result ? BigInt(results[3].result.toString()) : null
        } as TokenInfo;
    } catch (e) {
        console.error(`Error reading token data for ${tokenAddress}:`, e);
        return {
            address: tokenAddress,
            name: "Unknown",
            ticker: "UNK",
            decimals: 18,
            totalSupply: null
        };
    }
}

export async function getContractCreationInfo(tokenAddress:Address): Promise<ContractCreationInfo | null> {
    const apiKey: string | undefined = process.env.ETHERSCAN_API_KEY;

    if (!apiKey) {
        console.error("ETHERSCAN_API_KEY not found in environment variables");
        return null;
    }

    try {
        const url = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}&apikey=${apiKey}`;

        const response = await axios.get(url);

        if (response.data.status !== "1" || !response.data.result.length) {
            console.log(`No creation data found for: ${tokenAddress}`);
            return null;
        }

        return response.data.result[0] as ContractCreationInfo;
    } catch (e) {
        console.error(`Error reading token data for ${tokenAddress}:`, e);
    }
    return null;
}

export async function getOrCreateToken(context: Context, tokenInfo: TokenInfo, creationInfo: ContractCreationInfo | null): Promise<string> {
    const { db } = context;

    const existingToken = await db.sql.query.tokens.findFirst({
        where: eq(schema.tokens.contractAddress, tokenInfo.address)
    });

    if (existingToken) {
        return existingToken.id;
    }

    const insertResult = await db.insert(schema.tokens).values({
        name: tokenInfo.name,
        ticker: tokenInfo.ticker,
        decimals: tokenInfo.decimals,
        contractAddress: tokenInfo.address,
        creationBlock: creationInfo?.blockNumber || -1n,
        creationTxnHash: creationInfo?.txHash || null,
        deployerAddress: creationInfo?.contractCreator || null,
    });

    return insertResult.id;
}