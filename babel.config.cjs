module.exports = {
    retainLines: true,
    sourceMap: "inline",
    presets: [
        ['@babel/preset-env', { 
            targets: { 
                node: 10
            }
        }],
        '@babel/preset-typescript'
    ],
};