import React from "react";
import { Component } from "@react-fullstack/fullstack";
import WindowInterface from "@web-desktop-environment/interfaces/lib/views/Window";
import { withStyles, createStyles, WithStyles } from "@material-ui/styles";
import { Theme } from "@root/theme";
import ReactDOM from "react-dom";
import windowManager from "@state/WindowManager";
import { windowsBarHeight } from "@views/Desktop";
import Icon from "@components/icon";
import { Rnd } from "react-rnd";
import { ConnectionContext } from "@root/contexts";

export const defaultWindowSize = {
	height: 600,
	width: 700,
	maxHeight: 700,
	maxWidth: 1000,
	minHeight: 300,
	minWidth: 400,
};

export const windowBarHeight = 25;

const styles = (theme: Theme) =>
	createStyles({
		root: {
			width: "100%",
			height: "100%",
		},
		bar: {
			background: theme.windowBarColor,
			backdropFilter: theme.type === "transparent" ? "blur(15px)" : "none",
			border: theme.windowBorder
				? `1px solid ${theme.windowBorderColor}`
				: "none",
			borderBottom: "none",
			borderRadius: "7px 7px 0 0",
			cursor: "move",
			display: "flex",
			flexDirection: "row-reverse",
			height: windowBarHeight,
			width: "100%",
			justifyContent: "space-between",
		},
		barCollapse: {
			borderRadius: "7px 7px 7px 7px",
			borderBottom: `1px solid ${theme.windowBorderColor}`,
		},
		body: {
			borderRadius: "0 0 3px 3px",
			width: "100%",
			height: `calc(100% - ${windowBarHeight}px)`,
		},
		barButtonsContainer: {
			position: "relative",
			top: 4,
			right: 5,
			width: 40,
			height: 20,
			display: "flex",
			justifyContent: "space-between",
		},
		barButton: {
			width: 15,
			height: 15,
			borderRadius: "50%",
			zIndex: 2,
			border: "1px solid #0004",
		},
		barButtonExit: {
			cursor: "pointer",
			background: theme.error.main,
			"&:hover": {
				background: theme.error.dark,
			},
		},
		barButtonCollapse: {
			cursor: "pointer",
			background: theme.success.main,
			"&:hover": {
				background: theme.success.dark,
			},
		},
		barButtonInactive: {
			background: theme.primary.transparent,
		},
		barTitle: {
			position: "relative",
			top: 2,
			left: 45,
			width: "100%",
			textAlign: "center",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
			maxWidth: "calc(100% - 90px)",
			userSelect: "none",
			color: theme.background.text,
		},
		barTitleIcon: {
			position: "relative",
			top: 3,
		},
	});

type Size = {
	height: number;
	width: number;
};

interface WindowState {
	size: Size;
	canDrag: boolean;
	collapse: boolean;
	position: { x: number; y: number };
	isActive?: boolean;
}

class Window extends Component<
	WindowInterface,
	WindowState,
	WithStyles<typeof styles>
> {
	domContainer: Element;
	id!: number;
	wrapperRef?: HTMLDivElement;
	constructor(props: Window["props"]) {
		super(props);
		const size = {
			height: props.window.height || defaultWindowSize.height,
			width: props.window.width || defaultWindowSize.width,
		};
		this.state = {
			size,
			canDrag: false,
			collapse: props.window.minimized || false,
			position: this.getPosition(size),
		};

		this.domContainer = document.createElement("div");
		document.getElementById("app")?.appendChild(this.domContainer);
	}
	static contextType = ConnectionContext;
	context!: React.ContextType<typeof ConnectionContext>;
	getPosition = (size: Size) => {
		if (this.props.window.position) {
			const position = { ...this.props.window.position };
			if (position.x > window.innerWidth - size.width / 2) {
				position.x = position.x % window.innerWidth;
			}
			if (position.x < windowBarHeight) {
				position.x = windowBarHeight;
			}
			if (position.y > window.innerHeight) {
				position.y = window.innerHeight;
			}
			if (position.y < windowBarHeight) {
				position.y = windowBarHeight;
			}
			return position;
		} else {
			return {
				x: window.screen.availWidth / 3,
				y: window.screen.availHeight / 3,
			};
		}
	};

	componentDidMount() {
		this.id = windowManager.addWindow(this.props.name, this.props.icon, {
			minimized: this.props.window.minimized || false,
		});

		windowManager.emitter.on("minimizeWindow", ({ id }) => {
			this.props.setWindowState({
				minimized: true,
				position: this.state.position,
				size: this.state.size,
			});
			if (id === this.id) {
				this.setState({ collapse: true, isActive: true });
			} else this.setState({ isActive: false });
		});

		windowManager.emitter.on("maximizeWindow", ({ id }) => {
			this.props.setWindowState({
				minimized: false,
				position: this.state.position,
				size: this.state.size,
			});
			if (id === this.id) {
				this.setState({ collapse: false, isActive: true });
			} else this.setState({ isActive: false });
		});
		windowManager.emitter.on("setActiveWindow", ({ id }) => {
			if (id === this.id) {
				this.moveToTop();
			}
		});
		document.addEventListener("mousedown", (e) => {
			if (this.wrapperRef && e.target) {
				if (
					this.wrapperRef &&
					!this.wrapperRef.contains(e.target as HTMLElement)
				) {
					this.handleClickOutside();
				}
			}
		});
	}

	componentWillUnmount = () => {
		windowManager.closeWindow(this.id);
	};

	handleClickOutside = () => {
		this.setState({ isActive: false });
	};

	moveToTop = () => {
		this.setState({ isActive: true });
		// remove and readd window -> move to top in html tree
		const parent = document.getElementById("app");
		if (parent) {
			if (
				parent.childNodes[parent.childNodes.length - 1] !== this.domContainer
			) {
				parent.removeChild(this.domContainer);
				parent.appendChild(this.domContainer);
			}
		}
	};

	setActive = () => {
		if (windowManager.activeWindowId === this.id) {
			this.setState({ isActive: true });
		} else {
			windowManager.setActiveWindow(this.id);
		}
	};

	render() {
		const { size, canDrag, collapse, isActive, position } = this.state;
		const {
			children,
			classes,
			title,
			icon,
			window: windowSizes,
			onClose,
			setWindowState,
		} = this.props;
		const { maxHeight, maxWidth, minHeight, minWidth } = {
			...defaultWindowSize,
			...windowSizes,
		};
		return ReactDOM.createPortal(
			<div
				ref={(element) => {
					if (element) this.wrapperRef = element;
				}}
			>
				<Rnd
					disableDragging={!canDrag}
					size={size}
					position={position}
					onDrag={(e, newPosition) => {
						this.setActive();
						const touchTop = newPosition.y < 0;
						const touchBottom =
							newPosition.y >
							window.innerHeight - windowBarHeight - windowsBarHeight;
						const width = Number(String(size.width).replace("px", ""));
						const touchMinimumLeft = newPosition.x < 0 - width * 0.5;
						const touchMinimumRight =
							newPosition.x > window.innerWidth - width * 0.5;
						if (
							touchTop ||
							touchBottom ||
							touchMinimumLeft ||
							touchMinimumRight
						) {
							this.setState({ position: { ...position } });
							return;
						}
						this.setState({ position: { x: newPosition.x, y: newPosition.y } });
					}}
					onDragStop={(_e, newPosition) => {
						const touchTop = newPosition.y < 0;
						const touchBottom =
							newPosition.y >
							window.innerHeight - windowBarHeight - windowsBarHeight;
						const width = Number(String(size.width).replace("px", ""));
						const touchMinimumLeft = newPosition.x < 0 - width * 0.5;
						const touchMinimumRight =
							newPosition.x > window.innerWidth - width * 0.5;
						if (
							touchTop ||
							touchBottom ||
							touchMinimumLeft ||
							touchMinimumRight
						) {
							this.setState({ position: { ...position } });
							return;
						}
						this.setState({ position: { x: newPosition.x, y: newPosition.y } });
						setWindowState({
							position,
							minimized: this.state.collapse,
							size: this.state.size,
						});
					}}
					defaultSize={size}
					maxHeight={collapse ? windowBarHeight : maxHeight}
					maxWidth={maxWidth}
					minHeight={collapse ? windowBarHeight : minHeight}
					minWidth={minWidth}
					onResize={(e, _resize, ele, delta, newPosition) =>
						this.setState({
							size: {
								width: (ele.style.width as unknown) as number,
								height: (ele.style.height as unknown) as number,
								...newPosition,
							},
						})
					}
					onResizeStop={() =>
						setWindowState({
							position: this.state.position,
							minimized: this.state.collapse,
							size: this.state.size,
						})
					}
				>
					<div className={classes.root} onClick={() => this.setActive()}>
						<div
							onMouseEnter={() => this.setState({ canDrag: true })}
							onMouseLeave={() => this.setState({ canDrag: false })}
							className={`${classes.bar} ${
								this.state.collapse ? classes.barCollapse : ""
							}`}
						>
							<div className={classes.barButtonsContainer}>
								<div
									onClick={() => {
										windowManager.updateState(this.id, {
											minimized: !this.state.collapse,
										});
									}}
									className={`${classes.barButton} ${
										isActive
											? classes.barButtonCollapse
											: classes.barButtonInactive
									}`}
								/>
								<div
									className={`${classes.barButton} ${
										isActive ? classes.barButtonExit : classes.barButtonInactive
									}`}
									onClick={() => {
										onClose();
									}}
								/>
							</div>
							<div className={classes.barTitle}>
								{title} -{" "}
								{icon.type === "icon" ? (
									<Icon
										containerClassName={classes.barTitleIcon}
										name={icon.icon}
									/>
								) : (
									<img
										className={classes.barTitleIcon}
										alt="windows icon"
										width={14}
										height={14}
									/>
								)}
							</div>
						</div>
						{!collapse && <div className={classes.body}>{children}</div>}
					</div>
				</Rnd>
			</div>,
			this.domContainer
		);
	}
}

export default withStyles(styles, { withTheme: true })(Window);
