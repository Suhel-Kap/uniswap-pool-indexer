import {createConfig, factory} from "ponder";
import {http, getAbiItem} from "viem";
import {UniswapV3FactoryAbi} from "./abis/UniswapV3FactoryAbi";
import {UniswapV3PoolAbi} from "./abis/UniswapV3PoolAbi";
import {UniswapV2PairAbi} from "./abis/UniswapV2PairAbi";
import {UniswapV2FactoryAbi} from "./abis/UniswapV2FactoryAbi";
import {END_BLOCK, START_BLOCK} from "./src/utils/consts";

export default createConfig({
    database: {
        kind: "postgres",
        connectionString: process.env.DATABASE_URL,
    },
    networks: {
        mainnet: {chainId: 1, transport: http(process.env.PONDER_RPC_URL_1)},
    },
    contracts: {
        UniswapV3Pool: {
            network: "mainnet",
            abi: UniswapV3PoolAbi,
            address: factory({
                address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
                event: getAbiItem({abi: UniswapV3FactoryAbi, name: "PoolCreated"}),
                parameter: "pool",
            }),
            startBlock: parseInt(START_BLOCK.toString()),
            endBlock: parseInt(END_BLOCK.toString()),
            includeTransactionReceipts: true
        },
        UniswapV2Pair: {
            network: "mainnet",
            abi: UniswapV2PairAbi,
            address: factory({
                address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
                event: getAbiItem({abi: UniswapV2FactoryAbi, name: "PairCreated"}),
                parameter: "pair",
            }),
            startBlock: parseInt(START_BLOCK.toString()),
            endBlock: parseInt(END_BLOCK.toString()),
            includeTransactionReceipts: true
        }
    },
});