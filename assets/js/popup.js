document.addEventListener('DOMContentLoaded', function () {

    const SALES_ENDPOINT = 'https://api.envato.com/v3/market/author/sales?page=1';
    const USERNAME_ENDPOINT = 'https://api.envato.com/v1/market/private/user/username.json';
    const MONTHS_SALE_ENDPOINT = 'https://api.envato.com/v1/market/private/user/earnings-and-sales-by-month.json';
    const STATEMENT_ENDPOINT = 'https://api.envato.com/v3/market/user/statement';
    const USER_INFO_ENDPOINT = 'https://api.envato.com/v1/market/user:{username}.json';
    const ENVATO_SALES_DATA = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQdJG6f0rOmXaQCJZhp97plUwEm-Kq94p_o7nUoBxrsbsCgVMX1zx8y-A62xrl2cV0ckE8XykXF8NDd/pub?output=csv';

    const SHOW_LAST_N_SALE_LIST = 3;
    const SHOW_LAST_N_MONTHS = 4;
    const SHOW_LAST_N_DAYS = 14;
    const VERSION = 1;

    let token = false;

    chrome.storage.local.get('data', function (data) {

        if (data.data === undefined) return;

        token = data.data.token;

        if (token === undefined) return;
        start_init()
    });

    const AUTO_UPDATE_TIME_IN_SEC = 300;
    const box = document.getElementById("box");
    const head = document.getElementById("head");
    let api_data = {};
    let update_temp_data = false;
    let refresh_status = document.getElementById('refresh_data');

    async function start_init() {
        api_data = await get_storage_data('_temp_data');

        if (!api_data) {
            api_data = {};
            box.classList.add('loading');
            setRefreshing(true);
        }
        await init();
    }

    async function init() {
        try {
            await load_data();
            box.classList.remove('loading');
            let current_time = Math.floor(Date.now() / 1000);


            if (update_temp_data) {
                api_data['version'] = VERSION;
                api_data['update_time'] = current_time;
                chrome.storage.local.set({'_temp_data': api_data});
            }
            if ('update_time' in api_data) {
                let api_update_time = api_data['update_time'];

                if ((current_time - api_update_time) > AUTO_UPDATE_TIME_IN_SEC) {
                    refresh_data();
                    return true;
                }
            }
            setRefreshing(false);
            return true;
        } catch (e) {

            if (e.status === 401) {
                invalid_token();
            }
            console.log(e);
        }
    }

    function setRefreshing(refresh) {
        if (refresh) {
            refresh_status.classList.add('rotate');
        } else {
            refresh_status.classList.remove('rotate');
        }
    }

    refresh_status.addEventListener("click", function () {
        //refresh_data();
    });

    function refresh_data() {
        setRefreshing(true);
        api_data = {};
        init();
    }

    async function load_data() {
        await update_header();
        await update_months_sale_data();
        await update_graphs();
    }

    async function update_header() {

        let author_image, author_username;

        let sales_data = {};

        if ('sales_data' in api_data) {
            sales_data = api_data['sales_data'];
        } else {
            sales_data = await send_request(SALES_ENDPOINT);
            update_temp_data = true;
        }
        let sales_data_length = sales_data.length;

        if (!sales_data_length) {

            let username_data, account_info_data;
            if ('username_data' in api_data) {
                username_data = api_data['username_data'];
            } else {
                username_data = await send_request(USERNAME_ENDPOINT);
                api_data['username_data'] = username_data;
                update_temp_data = true;
            }

            author_username = username_data['username'];
        } else {
            let first_item_details = sales_data[0]['item'];
            author_username = first_item_details['author_username'];

            let title_suffix = 'was purchased';
            var list_wrapper = document.getElementById('last_few_sales_list');
            list_wrapper.innerHTML = '';
            for (var i = 0; i < Math.min(SHOW_LAST_N_SALE_LIST, sales_data_length); i++) {

                let item_details = parse_item_details(sales_data[i]);
                sales_data[i] = item_details;
                var list_item = document.createElement('li');
                list_item.setAttribute('class', 'sale_item_info');

                var list_item_wrapper = document.createElement('div');
                list_item_wrapper.setAttribute('class', 'sale_item_info_wrapper');

                var list_item_logo = document.createElement('img');
                list_item_logo.setAttribute('class', 'item_logo');
                list_item_logo.setAttribute('src', item_details['icon']);
                list_item_logo.setAttribute('alt', 'Item Logo');

                list_item_wrapper.appendChild(list_item_logo);

                var list_item_body = document.createElement('div');
                list_item_body.setAttribute('class', 'sale_item_info_body');

                var list_item_title = document.createElement('span');
                list_item_title.setAttribute('class', 'sale_item_title');
                var list_item_title_suffix = document.createElement('span');
                var list_item_purchase_duration = document.createElement('span');
                list_item_purchase_duration.setAttribute('class', 'font_600');
                list_item_title.innerText = item_details['name'];
                list_item_title_suffix.innerText = title_suffix;
                list_item_purchase_duration.innerText = calculate_date_diff(item_details['sold_at']);

                list_item_body.append(list_item_title);
                list_item_body.append(list_item_title_suffix);
                list_item_body.append(list_item_purchase_duration);


                list_item_wrapper.append(list_item_body);
                list_item.appendChild(list_item_wrapper);
                list_wrapper.appendChild(list_item);
            }

        }

        let user_info_data;
        if ('user_info_data' in api_data) {
            user_info_data = api_data['user_info_data'];
        } else {
            let user_endpoint = USER_INFO_ENDPOINT.replace("{username}", author_username);
            user_info_data = await send_request(user_endpoint);
        }

        author_image = user_info_data['user']['image'];
        let total_sales = Number(user_info_data['user']['sales']);
        head.querySelector('.author_total_sales_value').textContent = format_number(total_sales);

        head.querySelector('.author_image img').src = author_image;
        head.querySelector('.author_username').textContent = author_username;

        if (update_temp_data) {
            api_data['sales_data'] = sales_data;
            api_data['user_info_data'] = user_info_data;
        }
    }

    async function update_months_sale_data() {
        let month_data_wrapper = document.getElementById('last_few_month_sales');
        let total_sales = 0;
        let months_data;
        if ('earnings-and-sales-by-month' in api_data) {
            months_data = api_data['earnings-and-sales-by-month'];
        } else {
            let data = await send_request(MONTHS_SALE_ENDPOINT);
            months_data = data['earnings-and-sales-by-month'];
            api_data['earnings-and-sales-by-month'] = months_data;
            update_temp_data = true;
        }

        let total_months = months_data.length;
        let html = '';

        for (var i = total_months - 1; i >= Math.max(0, total_months - SHOW_LAST_N_MONTHS); i--) {
            var month = months_data[i];
            var month_sales = month['sales'];
            total_sales += Number(month_sales);
            var month_date = new Date(month['month']);
            month_date.setTime(month_date.getTime() - month_date.getTimezoneOffset() * 60000);

            var formatted_month_sales = format_number(month_sales);
            var month_sale_value = '$' + format_number(month['earnings']);
            var month_name = month_date.toLocaleString('default', {month: 'short'});
            html += '<div class="month_sale_info">\n' +
                '                <div class="month_name font_bold">' + month_name + '</div>\n' +
                '                <div class="month_data">\n' +
                '                    <div class="sale_count font_bold">' + formatted_month_sales + '</div>\n' +
                '                    <div class="sale_value font_bold">' + month_sale_value + '</div>\n' +
                '                </div>\n' +
                '            </div>';


        }

        month_data_wrapper.innerHTML = html;
    }

    async function update_graphs() {
        let total_sales = [];
        let page = 1;
        let envato_total_sales = [];
        if ('last_n_day_sales' in api_data) {
            total_sales = api_data['last_n_day_sales'];
            envato_total_sales = api_data['envato_total_sales'];

            create_graphs(envato_total_sales, total_sales);
        } else {
            envato_total_sales = await get_envato_data();

            let from_date = new Date();
            from_date.setDate(from_date.getDate() - SHOW_LAST_N_DAYS);
            let to_date = new Date();
            let url = new URL(STATEMENT_ENDPOINT);
            url.searchParams.append('type', 'Sale');
            url.searchParams.append('from_date', format_date(from_date));
            url.searchParams.append('to_date', format_date(to_date));
            while (true) {
                url.searchParams.append('page', page);
                var fetch = await send_request(url.toString());

                var results = fetch['results'];
                var pagination = fetch['pagination'];

                var page_size = pagination['page_size'];
                var results_length = results.length;

                total_sales = total_sales.concat(results);
                if (results_length === page_size) {
                    page++;
                } else {
                    break;
                }

            }

            await data_to_graph(envato_total_sales, total_sales);
        }
    }

    async function data_to_graph(envato_total_sales, total_sales) {
        let date_series = create_date_series();

        let sale_date_series = Object.assign({}, date_series);
        for (var i = 0; i < total_sales.length; i++) {
            var sale_details = total_sales[i];
            var sale_date = sale_details['date'].split(' ')[0];
            if (sale_date in sale_date_series) {
                sale_date_series[sale_date] += 1;
            }
        }

        let envato_date_series = Object.assign({}, date_series);

        for (var e = 0; e < envato_total_sales.length; e++) {
            var envato_details = envato_total_sales[e];
            var envato_date_string = envato_details['Date'];
            var total_sales_string = envato_details['Total Sales'];
            if(total_sales_string) {
                total_sales_string = total_sales_string.replace(/\D/g, '');
            }
            var envato_sale_total_sales = Number(total_sales_string);
            var envato_sale_date = new Date(envato_date_string);
            var formatted_envato_sale_date = format_date(envato_sale_date);
            if (formatted_envato_sale_date in envato_date_series) {
                envato_date_series[formatted_envato_sale_date] = envato_sale_total_sales;
            }
        }

        api_data['envato_total_sales'] = envato_date_series;
        api_data['last_n_day_sales'] = sale_date_series;
        update_temp_data = true;

        create_graphs(envato_date_series, sale_date_series);
    }

    function create_graphs(envato_trend, item_sales) {

        let trend_line = document.getElementById('trend_line');

        let xOffset = 0;
        let options = {
            chart: {
                height: Math.max(174, trend_line.offsetHeight),
                width: Math.max(485, trend_line.offsetWidth + xOffset),
                type: "area",
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false,
                    autoScaleYaxis: false,
                },
                selection: {
                    enabled: false
                },
                sparkline: {
                    enabled: false,
                }
            },
            dataLabels: {
                enabled: false
            },
            series: [
                {
                    name: "Envato Trend",
                    data: convert_to_ratios(Object.values(envato_trend)),
                    color: "#7CB34226",
                },
                {
                    name: "Item Sales",
                    data: convert_to_ratios(Object.values(item_sales)),
                    color: "#003750BF",
                }
            ],
            fill: {
                type: ['gradient', 'pattern'],
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.2,
                    opacityTo: 0.2,
                    gradientToColors: ['', '#003750'],
                },
                pattern: {
                    strokeWidth: 0,
                },
            },
            xaxis: {
                labels: {
                    show: false,
                },
                axisBorder: {
                    show: false,
                },
                axisTicks: {
                    show: false,
                },
                crosshairs: {
                    show: false
                },
                tooltip: {
                    enabled: false,
                },
                padding: {
                    bottom: -10,
                },
            },
            markers: {
                size: [0, 3],
                strokeColors: '#003750',
            },
            stroke: {
                curve: 'smooth',
                width: 3,
                lineCap: 'round',
            },
            legend: {
                show: false,
            },
            yaxis: {
                show: false,
            },
            grid: {
                show: false,
                padding: {
                    left: xOffset,
                },
            },
            tooltip: {
                custom: function (data) {
                    const {series, seriesIndex, dataPointIndex, w} = data;

                    var item_sales_key = Object.keys(item_sales);
                    var index = dataPointIndex;
                    var date_string = item_sales_key[index];

                    var date = new Date(date_string);
                    var value = item_sales[date_string];
                    var formatted_date = date.toLocaleString('default', {day: 'numeric', month: 'short'});
                    return '<div class="graph-tooltip">' +
                        '<span class="graph-tooltip_date font_600">' + formatted_date + '&nbsp:&nbsp;</span>' +
                        '<span class="graph-tooltip_date-value font_600">' + format_number(value) + '</span>' +
                        '</div>';

                }
            },
        };

        let chart = new ApexCharts(trend_line, options);

        chart.render();
    }

    function invalid_token() {
        box.classList.add('show-invalid_token');
    }

    async function get_envato_data() {
        let csv_data = await get_csv_data(ENVATO_SALES_DATA);
        return parse_csv_data(csv_data)
    }


    function parse_csv_data(csv_data) {
        const valuesRegExp = /"([^"]*(?:""[^"]*)*)"|([^",]+)/g;
        const csv_array = csv_data.toString().split(/\r?\n|\r|\n/g);
        const data = [];
        const headers = csv_array[0].split(",");
        for (let i = 1; i < csv_array.length - 1; i++) {
            var json = {};
            let matches;
            var j = 0;
            while (matches = valuesRegExp.exec(csv_array[i])) {
                var value = matches[1] || matches[2];
                value = value.replace(/""/g, "\"");
                var title = headers[j];

                if (!title) {
                    continue;
                }
                title = title.trim();
                json[title] = value;
                j++;
            }

            data.push(json);
        }
        return data;
    }

    async function get_csv_data(endpoint) {
        let fetch_endpoint = await fetch(endpoint, {
            headers: {
                'Authorization': "Bearer " + token
            }
        });

        if (fetch_endpoint.status === 200) {
            return await fetch_endpoint.text();
        } else {
            throw new RestException(fetch_endpoint.status);
        }
    }

    async function send_request(endpoint) {
        let fetch_endpoint = await fetch(endpoint, {
            headers: {
                'Authorization': "Bearer " + token
            }
        });
        if (fetch_endpoint.status === 200) {
            return await fetch_endpoint.json();
        } else {
            throw new RestException(fetch_endpoint.status);
        }
    }

    function RestException(status) {
        let error = new Error("Endpoint Error");
        error.status = status;
        return error;
    }

    RestException.prototype = Object.create(Error.prototype);

    function parse_item_details(response) {
        var item = response.item;

        var purchase_details = {};
        purchase_details['id'] = item.id;
        purchase_details['name'] = item.name;
        purchase_details['icon'] = item.previews.icon_preview.icon_url;

        purchase_details['buyer'] = response.buyer;
        purchase_details['sold_at'] = response.sold_at;
        purchase_details['support_until'] = response.supported_until;
        purchase_details['license'] = response.license;

        purchase_details['item'] = response.item;
        purchase_details['author_username'] = response.author_username;
        purchase_details['number_of_sales'] = response.number_of_sales;
        purchase_details['author_image'] = response.author_image;

        return purchase_details;
    }

    function convert_to_ratios(values) {
        var max = Math.max(...values);
        return values.map(v => (v / max) * 100);
    }


    function format_number(num) {
        return !num ? '0' : num.toLocaleString();
    }

    function create_date_series() {
        let date_series = {};
        let date = new Date();
        for (var i = 0; i <= SHOW_LAST_N_DAYS; i++) {
            var date_string = format_date(date);
            date_series[date_string] = 0;
            date.setDate(date.getDate() - 1);
        }
        return date_series;
    }

    function calculate_date_diff(sale_date_string) {
        var sale_date = new Date(sale_date_string)
        var date_now = new Date();

        var seconds = Math.floor((date_now - sale_date) / 1000);

        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        var weeks = Math.floor(days / 7);
        var months = Math.floor(days / 30);
        var year = Math.floor(months / 12);

        let duration = 0;
        let duration_type = ''
        if (year >= 1) {
            duration = year
            duration_type = 'yr'
        } else if (months >= 1) {
            duration = months
            duration_type = 'mo'
        } else if (weeks >= 1) {
            duration = weeks
            duration_type = 'wk'
        } else if (days >= 1) {
            duration = days
            duration_type = 'day'
        } else if (hours >= 1) {
            duration = hours
            duration_type = 'hr'
        } else if (minutes >= 1) {
            duration = minutes
            duration_type = 'min'
        } else {
            return 'just now';
        }
        duration = Math.round(duration)
        if (duration > 1) {
            duration_type = duration_type + 's'
        }

        return (duration + ' ' + duration_type + ' ago')

    }

    function format_date(date) {
        return date.toISOString().split('T')[0];
    }

    async function get_storage_data(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, function (result) {
                if (result[key] === undefined) {
                    resolve(false);
                } else {
                    resolve(result[key]);
                }
            });
        });
    };

}, false);
