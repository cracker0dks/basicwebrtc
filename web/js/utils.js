function getUrlParam(parameter, defaultvalue) {
    var urlparameter = defaultvalue;
    if (window.location.href.indexOf(parameter) > -1) {
        urlparameter = getUrlVars()[parameter];
    }
    let ret = decodeURIComponent(urlparameter);
    ret = ret == "false" ? false : ret;
    return ret;
}

function getUrlVars() {
    const parseVars = (str) => {
        if (str.length <= 1) {
            return {}
        }
        const keyValuePairs = str.substring(1).split("&")
        const res = {}
        for (let i = 0; i < keyValuePairs.length; i++) {
            const keyValuePair = keyValuePairs[i];
            const [key, value] = keyValuePair.split('=')
            res[key] = value
        }
        return res
    }

    return Object.assign(
        {},
        parseVars(window.location.search),
        parseVars(window.location.hash)
    )
}

function uuidv4() {
    if (crypto) { //Generate uuid with crypto if possible
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    } else { //Fallback to random if crypto is not implemented in the browser
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}