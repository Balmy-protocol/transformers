# Mean Transformers

[![Lint](https://github.com/Mean-Finance/mean-transformers/actions/workflows/lint.yml/badge.svg)](https://github.com/Mean-Finance/mean-transformers/actions/workflows/lint.yml)
[![Tests (unit, integration, e2e)](https://github.com/Mean-Finance/mean-transformers/actions/workflows/tests.yml/badge.svg)](https://github.com/Mean-Finance/mean-transformers/actions/workflows/tests.yml)
[![npm version](https://img.shields.io/npm/v/@mean-finance/mean-transformers/latest.svg)](https://www.npmjs.com/package/@mean-finance/mean-transformers/v/latest)

With this repository, we are now defining the concept of **dependent tokens**. These are tokens that depend on one or more underlying tokens, they can't exist on their own. This concept can apply to some know type of tokens, such as:

- Wrappers (WETH/WMATIC/WBNB)
- ERC-4626 tokens
- LP tokens

In this repository, we will build our `Transformers`. These are smart contract that know how to map dependent tokens into their underlying counterparts, and vice-versa. We are doing this so that we can abstract the way tokens can be transformed between each other.

Finally, this repository also contains Mean's "transformers registry". All _transformers_ will be registered to this contract, so that all clients can interact with the registry directly, without having to know all existing _transformers_.

## 📦 NPM/YARN Package

- NPM Installation

```bash
npm install @mean-finance/transformers
```

- Yarn installation

```bash
yarn add @mean-finance/transformers
```

## 👨‍💻 Development environment

- Copy environment file

```bash
cp .env.example .env
```

- Fill environment file with your information

```bash
nano .env
```

## 🧪 Testing

### Unit

```bash
yarn test:unit
```

Will run all tests under [test/unit](./test/unit)

### E2E

```bash
yarn test:e2e
```

Will run all tests under [test/e2e](./test/e2e)

### Integration

You will need to set up the development environment first, please refer to the [development environment](#-development-environment) section.

```bash
yarn test:integration
```

Will run all tests under [test/integration](./test/integration)

## 🚢 Deployment

You will need to set up the development environment first, please refer to the [development environment](#-development-environment) section.

```bash
yarn deploy --network [network]
```

The plugin `hardhat-deploy` is used to deploy contracts.
