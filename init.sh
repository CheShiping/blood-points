#!/bin/bash
set -e

echo "=== Harness 初始化（BloodPoints）==="

echo "=== 智能合约：编译与测试 ==="
npx hardhat compile
npx hardhat test
npx hardhat test solidity

echo "=== 前端：安装、构建与 lint ==="
cd frontend
npm install
npm run build
npm run lint
cd ..

echo "=== 验证完成 ==="
echo ""
echo "下一步："
echo "1. 阅读 feature_list.json 查看当前功能状态"
echo "2. 挑选一个未完成的「单一功能」着手"
echo "3. 只实现该功能，并在声称完成前重新运行 ./init.sh"
