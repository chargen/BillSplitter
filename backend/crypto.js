exports.scrypt = scryptHash;

var scrypt = require('scryptsy')

function scryptHash(input, salt) {
    var digest = scrypt(input, salt, 16384, 8, 1, 64);
    return digest.toString('base64'); // bytes, string
}

function randomString(length) {
    var s = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=[{]}\|~/?.>,<;:";
    for (var i = 0; i < length; i++) {
        s += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return s;
}