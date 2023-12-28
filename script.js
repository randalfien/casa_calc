function formatCurrency(value) {
    if( Math.abs(value) < 0.0001) return '0';
	// Format the number with a space as the thousand separator
	return new Intl.NumberFormat('en-US', {
		style: 'decimal',
		maximumFractionDigits: 0,
		minimumFractionDigits: 0
	}).format(value).replace(/,/g, ' ');
}

function adjustForInflation(amount, years, inflationRate){
	return amount / Math.pow(1+inflationRate, years);
}

let totalInterestPaidEachYear = [];
let remainingBalanceEachYear = [];
let interestRatesEachYear = [];
let mortgageChart = null;
let loanTermYearsSaved = 0;
let setInterestValue = "";
let savedValues = [];
let lastCalculationArgs = null;
function calculateMortgage(arguments) {
	let tableRows = '';
	let loanTermYears = arguments.loanTermYears;
	let totalPayments = loanTermYears * 12;
	let currentBalance = arguments.principal;
	let totalInterestPaid = 0;
	let totalWithInflation = 0;
	totalInterestPaidEachYear = [];
	remainingBalanceEachYear = [];
	interestRatesEachYear = [];
	setInterestValue = arguments.interest.toFixed(2)+"%";

	let lastYearMonths = 12;
	for (let year = 1; year <= loanTermYears; year++) {

		let annualInterestRate = arguments.interestRates[year-1];

		const monthlyInterestRate = annualInterestRate / 100 / 12;

		let interestPaidThisYear = 0;
		let principalPaidThisYear = 0;
		let monthlyPayment = 0;
		let maxMonth = year === loanTermYears ? lastYearMonths : 12;
		for (let month = 1; month <= maxMonth; month++) {
			if (month === 1 || year === 1) {
				monthlyPayment = currentBalance * monthlyInterestRate / (1 - Math.pow(1 + monthlyInterestRate, -(totalPayments - (year - 1) * 12 - (month - 1))));
			}

			let interestForThisMonth = currentBalance * monthlyInterestRate;
			let principalForThisMonth = monthlyPayment - interestForThisMonth;

			interestPaidThisYear += interestForThisMonth;
			principalPaidThisYear += principalForThisMonth;

			currentBalance -= principalForThisMonth;
		}

		let extraPaymentAmount = 0;
		let extraPaymentShortening = false;
		let extraPayment = arguments.extraPayments[year-1];
		if( extraPayment != null ){
			extraPaymentAmount = extraPayment.amount;
			extraPaymentShortening = extraPayment.shortening;
		}


		if( extraPaymentAmount > currentBalance){
			extraPaymentAmount = currentBalance;
		}

		currentBalance -= extraPaymentAmount;
		principalPaidThisYear += extraPaymentAmount;

		totalInterestPaid += interestPaidThisYear;

		  // Check if the mortgage is being shortened
		if (extraPaymentAmount > 0 && extraPaymentShortening) {
			// Recalculate the remaining term of the loan
			let remainingPayments = Math.ceil(Math.log(monthlyPayment / (monthlyPayment - monthlyInterestRate * currentBalance)) / Math.log(1 + monthlyInterestRate));
            var remainsYears = remainingPayments / 12;
			lastYearMonths = remainingPayments % 12;
			loanTermYears = Math.min(loanTermYears, Math.ceil(year + remainsYears));
			totalPayments = (loanTermYears-1)*12 + lastYearMonths;
		}

		totalWithInflation += adjustForInflation(principalPaidThisYear, year-1, arguments.inflation);
		totalWithInflation += adjustForInflation(interestPaidThisYear, year-1, arguments.inflation);

		// Add values to the arrays
		totalInterestPaidEachYear.push(totalInterestPaid);
		remainingBalanceEachYear.push(currentBalance);
		interestRatesEachYear.push(annualInterestRate);
		tableRows += `<tr>
				<td>${year}</td>
				<td>${formatCurrency(monthlyPayment)}</td>
				<td>${formatCurrency(adjustForInflation(monthlyPayment, year-1, arguments.inflation))}</td>
				<td style='position:relative'><span contenteditable="true" class='editable' id="interestRate${year}">${annualInterestRate.toFixed(2)}%</span><button title='Copy value to all rows below.' class="cell-btn">▼</button></td>
				<td>${formatCurrency(principalPaidThisYear)}</td>
				<td>${formatCurrency(interestPaidThisYear)}</td>
				<td>${formatCurrency(currentBalance)}</td>
				<td style='position:relative'> <span contenteditable="true" class='editable' id="extraPayment${year}"> ${formatCurrency(extraPaymentAmount)}</span>
				<label for="extraPaymentShort${year}" style="display:${extraPaymentAmount>0 ? 'inline' : 'none'}"> 
					<input type="radio" id="extraPaymentShort${year}" name="option${year}" value="shortening" ${extraPaymentShortening ? 'checked' : ''}> shorter </label>
				<label for="extraPaymentLower${year}" style="display:${extraPaymentAmount>0 ? 'inline' : 'none'}">
					<input type="radio" id="extraPaymentLower${year}" name="option${year}" value="lower" ${extraPaymentShortening ? '' : 'checked'}> lower payments </label>
				</td>
			  </tr>`;
	}

	loanTermYearsSaved = loanTermYears;

	document.getElementById('mortgageTableBody').innerHTML = tableRows;

	document.getElementById('totalInterestPaidLabel').innerHTML = "Total interest paid: " + formatCurrency(totalInterestPaid);
	document.getElementById('totalPaidLabel').innerHTML = "Total amount paid: " + formatCurrency(totalInterestPaid + arguments.principal);
	document.getElementById('totalPaidInStartYearMoney').innerHTML = "Total paid with inflation: " + formatCurrency(totalWithInflation);

	updateGraph(totalInterestPaidEachYear, remainingBalanceEachYear,interestRatesEachYear);

	for (let year = 1; year <= loanTermYears; year++) {
		document.getElementById(`extraPayment${year}`).addEventListener('input', function() {
			document.getElementById('runButton').innerHTML = "Recalculate Mortgage";
			var value = this.textContent.trim();
			var valueNumber = parseFloat(value);
				// Check if the value is a number and greater than 0
			if (!isNaN(valueNumber) && valueNumber > 0) {
				// Show the radio buttons
				document.querySelectorAll(`#extraPaymentShort${year}, #extraPaymentLower${year}`).forEach(function(radio) {
					radio.parentNode.style.display = 'inline';
				});
			} else {
				// Hide the radio buttons
				document.querySelectorAll(`#extraPaymentShort${year}, #extraPaymentLower${year}`).forEach(function(radio) {
					radio.parentNode.style.display = 'none';
				});
			}
		}, false);
	}

	redoButtonVisibility();

	for (let year = 1; year <= loanTermYears; year++) {
		document.getElementById(`interestRate${year}`).addEventListener('input', function() {
			document.getElementById('runButton').innerHTML = "Recalculate Mortgage";
			redoButtonVisibility();
		}, false);
	}
}

function redoButtonVisibility(){
	let lastValue = null;
	for (let year = loanTermYearsSaved; year >= 1; year--) {
		var elem = document.getElementById(`interestRate${year}`);
		var button = elem.closest('td').querySelector('button');
		if ( year === loanTermYearsSaved ){
			button.style.visibility = "hidden";
		}else {
			if (year === 1 && elem.innerHTML != setInterestValue || year > 1 && elem.innerHTML != lastValue) {
				button.style.visibility = "visible";
				button.addEventListener('click', function (e) {
					var rowIndex = this.closest('tr').rowIndex;
					var value = this.closest('td').querySelector('.editable').textContent;
					for (let j = rowIndex; j <= loanTermYearsSaved; j++) {
						var interestRateElement = document.getElementById(`interestRate${j}`);
						interestRateElement.innerHTML = value;
					}
					redoButtonVisibility();
					e.stopImmediatePropagation();
				});
			} else {
				button.style.visibility = "hidden";
			}
		}
		lastValue = elem.innerHTML;
	}
}

function performCalculation() {
	const principal = parseFloat(document.getElementById('principal').value);
	const loanTermYears = parseInt(document.getElementById('years').value);
	const interest = parseFloat(document.getElementById('interest').value);
	const inflation = parseFloat(document.getElementById('inflation').value)/100;
	document.getElementById('interest').disabled = true;
	let arguments = {	principal: principal, loanTermYears:loanTermYears,interest:interest,inflation:inflation };
	arguments.extraPayments = [];
	arguments.interestRates = [];

	for (let year = 1; year <= loanTermYears; year++) {
		let interestRate = 0;
		let interestRateElement = document.getElementById(`interestRate${year}`);
		if( interestRateElement != null ){
			interestRate = parseFloat(interestRateElement.innerHTML.trim());
		}else{
			interestRate = interest;
		}
		arguments.interestRates[year-1] = interestRate;

		let extraPaymentElement = document.getElementById(`extraPayment${year}`);
		if( extraPaymentElement != null ){
			let extraPaymentAmount = parseFloat(extraPaymentElement.innerHTML.trim());
			let extraPaymentShortening = false;
			if (extraPaymentAmount > 0) {
				let epShortElem = document.getElementById(`extraPaymentShort${year}`);
				extraPaymentShortening = epShortElem == null ? false : epShortElem.checked === true;
			}
			arguments.extraPayments[year-1] = extraPaymentAmount === 0 ? null : {amount:extraPaymentAmount, shortening: extraPaymentShortening};
		}else{
			arguments.extraPayments[year-1] = null;
		}
	}

	calculateMortgage(arguments);

	lastCalculationArgs = arguments;
}

function selectSavedValue(i){

}

function saveCurrentValues(i){
	savedValues[i] = lastCalculationArgs;

}

function updateGraph(totalInterestPaidEachYear, remainingBalanceEachYear, interestRatesEachYear) {
	const ctx = document.getElementById('mortgageGraph').getContext('2d');

	if (mortgageChart) {
		mortgageChart.destroy();
	}

	mortgageChart = new Chart(ctx, {
		type: 'bar', // Bar chart type for the primary data
		data: {
			labels: Array.from({ length: totalInterestPaidEachYear.length }, (_, i) => i + 1),
			datasets: [{
				label: 'Total Interest Paid',
				backgroundColor: 'rgba(255, 99, 132, 0.2)',
				borderColor: 'rgba(255, 99, 132, 1)',
				borderWidth: 1,
				data: totalInterestPaidEachYear
			}, {
				label: 'Remaining Balance',
				backgroundColor: 'rgba(54, 162, 235, 0.2)',
				borderColor: 'rgba(54, 162, 235, 1)',
				borderWidth: 1,
				data: remainingBalanceEachYear
			}, {
				label: 'Interest Rate',
				type: 'line', // Line chart type for the interest rate data
				borderColor: 'rgba(133, 133, 133, 1)',
				borderWidth: 2,
				fill: false,
				data: interestRatesEachYear,
				yAxisID: 'y-axis-2' // Use a secondary Y-axis for the interest rates
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: {
				x:{
					display: true,
					label: 'Year'
				},
				y: {
					beginAtZero: true,
					min: 0,
					suggestedMax: 100,
					type: 'linear',
					display: true,
					position: 'left',
					label: 'Amount'
				},
				'y-axis-2': {
					type: 'linear',
					display: true,
					position: 'right',
					gridLines: {
						drawOnChartArea: false, // only want the grid lines for one axis to show
					},
					labels: {
						show: true,
					},
					suggestedMax: 10, // Assuming interest rate percentages
					label: 'Interest Rate (%)',
					ticks: {
						callback: function(value, index, ticks) {
							return  value+'%';
						}
					}
				}
			}
		}
	});
}
