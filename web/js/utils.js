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
        if(str.length <= 1){
            return {}
        }
        const keyValuePairs  = str.substring(1).split("&")
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