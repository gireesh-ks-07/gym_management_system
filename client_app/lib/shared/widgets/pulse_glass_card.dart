import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/pulse_colors.dart';

class PulseGlassCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final double borderRadius;
  final bool animateTap;
  final Color? color;
  final BorderSide? border;

  const PulseGlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16.0),
    this.onTap,
    this.borderRadius = 24.0,
    this.animateTap = true,
    this.color,
    this.border,
  });

  @override
  State<PulseGlassCard> createState() => _PulseGlassCardState();
}

class _PulseGlassCardState extends State<PulseGlassCard> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.96).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    if (widget.onTap != null && widget.animateTap) {
      _controller.forward();
    }
  }

  void _handleTapUp(TapUpDetails details) {
    if (widget.onTap != null && widget.animateTap) {
      _controller.reverse();
    }
  }

  void _handleTapCancel() {
    if (widget.onTap != null && widget.animateTap) {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget cardContent = ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18.0, sigmaY: 18.0),
        child: Container(
          decoration: BoxDecoration(
            color: widget.color ?? PulseColors.card,
            borderRadius: BorderRadius.circular(widget.borderRadius),
            border: Border.fromBorderSide(
              widget.border ?? BorderSide(color: PulseColors.border, width: 1.0),
            ),
          ),
          padding: widget.padding,
          child: widget.child,
        ),
      ),
    );

    if (widget.onTap != null) {
      return GestureDetector(
        onTapDown: _handleTapDown,
        onTapUp: _handleTapUp,
        onTapCancel: _handleTapCancel,
        onTap: widget.onTap,
        behavior: HitTestBehavior.opaque,
        child: widget.animateTap
            ? ScaleTransition(
                scale: _scaleAnimation,
                child: cardContent,
              )
            : cardContent,
      );
    }

    return cardContent;
  }
}
