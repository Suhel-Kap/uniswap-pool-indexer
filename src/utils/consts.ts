import { Mutex } from 'async-mutex';
import {Address} from "viem";

export const globalMutex = new Mutex();
export const uniswapV2Mutex = new Mutex();
export const uniswapV3Mutex = new Mutex();


// export const START_BLOCK = 22256934; // Apr-13-2025 02:02:59 AM +UTC
export const START_BLOCK = 21128976n;
export const END_BLOCK: string | bigint = 21129976n; // "latest" or 21129976n

export const SWAP_TOPIC: Address = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"; // keccak256("Swap(address,address,int256,int256,uint160,uint128,int24)")

export const LP_TOKENS = {
    "WETH": {
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        decimals: 18,
        name: "Wrapped Ether",
    },
    "USDT": {
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        decimals: 6,
        name: "Tether USD",
    },
    "USDC": {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
        name: "USDC",
    },
}